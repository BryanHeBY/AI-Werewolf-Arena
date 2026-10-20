/**
 * 单元测试：验证守卫配置的重复目标语义。输入为相邻夜、前次合法行动和明确空守；原字面历史与拒绝断言区分政策。只调用有界机制与提示，不运行模型或完整对局驱动。
 */
import { bindTargetHintContext } from "../../../../src/agents/tool-repair/target-hint-registry";
import { renderRolePrompt } from "../../../../src/agents/observation/role-presentation";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  type BoardConfig,
  type GameEvent,
  type GuardRepeatPolicy,
  type RoleComponent,
  type ToolCall,
} from "../../../../src/domain";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { GUARD_NIGHT_STAGES } from "../../../../src/features/guard/night-stages";
import { findNightAbility } from "../../../../src/features/night-abilities/abilities";
import { projectNightAbility } from "../../../../src/agents/observation/night-ability-projection";
import { getDefaultTargetHintRegistry } from "../../../../src/agents/tool-repair/target-hint-registry";
import { getDefaultConfigRenderRegistry } from "../../../../src/agents/prompt/config-render-registry";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import {
  nightStageContext,
  executeNightStage,
} from "../../../support/builders/night-stage-context";

const roles = [Role.Wolf, Role.Guard, Role.Seer, Role.Villager, Role.Villager, Role.Villager];
const guard = GUARD_NIGHT_STAGES.find((stage) => stage.id === "guard_action")!;
const choose = (target_id: number): Extract<ToolCall, { name: "guard" }> => ({
  name: "guard",
  args: { target_id, abstain: false },
});
const empty: Extract<ToolCall, { name: "guard" }> = {
  name: "guard",
  args: { target_id: null, abstain: true },
};
function setup(policy?: GuardRepeatPolicy, locale: "zh-CN" | "en" = "en") {
  const input: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((id) => id === role).length,
    })),
    ...(policy ? { guard: { repeatPolicy: policy } } : {}),
  };
  const resolved = parseBoardDefinition(boardDefinitionFromConfig("guard_policy", input));
  const game = bootstrapGame(resolved.config, { fixedRoles: roles, locale });
  const ability = findNightAbility(game.world.getComponent(2, COMPONENT.Role)!, "guard")!;
  const events: GameEvent[] = [];
  const act = async (day: number, action: Extract<ToolCall, { name: "guard" }> | null) => {
    const factory = new GameActionRequestFactory(game.world, events, day);
    await executeNightStage(guard)(
      nightStageContext({
        world: game.world,
        events,
        currentDay: () => day,
        actionProvider: {
          async getAction() {
            return action;
          },
        },
        makeRequest: (actorId, allowedTools, extra) =>
          factory.create({
            actorId,
            allowedTools,
            phase: Phase.Night,
            stage: extra.stage,
            context: extra,
            requiresAction: false,
            summary: "Offline guard policy",
          }),
      }),
    );
  };
  return { ...game, ...resolved, ability, events, act };
}

for (const policy of ["awa_last_action_v1", "netease_consecutive_nights_v1"] as const) {
  for (const skipped of ["wait", "invalid"] as const)
    test(`${policy}/${skipped}: actual-night adjacency differs explicitly from the last accepted action`, async () => {
      const game = setup(policy);
      await game.act(1, choose(4));
      await game.act(2, skipped === "wait" ? null : choose(999));
      expect(game.ability.state.lastTarget).toBe(4);
      expect(game.ability.lastUsedDay).toBe(1);
      const hint = getDefaultTargetHintRegistry().buildActionableIdsHint(
        bindTargetHintContext({
          world: game.world,
          actorId: 2,
          actorRole: Role.Guard,
          day: 3,
          abilityId: game.ability.id,
          allowedTools: ["guard"],
        }),
      )!;
      const ids = hint.match(/\b\d+\b/g)?.map(Number) ?? [];
      expect(ids.includes(4)).toBe(policy === "netease_consecutive_nights_v1");
      await game.act(3, choose(4));
      expect(game.events.filter((event) => event.type === "guard_applied")).toHaveLength(
        policy === "netease_consecutive_nights_v1" ? 2 : 1,
      );
      expect(game.ability.lastUsedDay).toBe(policy === "netease_consecutive_nights_v1" ? 3 : 1);
      expect(game.ability.state.lastTarget).toBe(4);
    });
  test(`${policy}: adjacent repeat is rejected and explicit empty guard breaks the chain`, async () => {
    const game = setup(policy);
    await game.act(1, choose(2)); // 官方政策允许自守。
    await game.act(2, choose(2));
    expect(game.ability.uses).toBe(1);
    expect(game.ability.lastUsedDay).toBe(1);
    await game.act(2, empty);
    expect(game.ability.state.lastTarget).toBeNull();
    await game.act(3, choose(2));
    expect(game.ability.uses).toBe(2);
    expect(game.events.filter((event) => event.type === "guard_applied")).toHaveLength(3);
  });
  test(`${policy}: role parameters round-trip and both prompt languages describe the same consumed policy`, () => {
    for (const locale of ["zh-CN", "en"] as const) {
      const game = setup(policy, locale);
      expect(game.definition.roles.guard).toEqual({ repeatPolicy: policy });
      expect(boardDefinitionFromConfig(game.definition.id, game.config)).toEqual(game.definition);
      expect(
        getDefaultConfigRenderRegistry().renderBoardConfigPrompt(game.config, locale),
      ).toContain(policy);
      expect(renderRolePrompt(game.world.getComponent(2, COMPONENT.Role)!, locale)).toContain(
        policy,
      );
      expect(projectNightAbility(game.ability, 1).state).toEqual(
        policy === "netease_consecutive_nights_v1"
          ? { lastTarget: null, repeatPolicy: policy }
          : { lastTarget: null },
      );
    }
  });
}

test("omission retains AWA semantics and misspelled, future or inert parameters fail closed", async () => {
  const game = setup();
  expect(game.definition.roles.guard).toEqual({ repeatPolicy: "awa_last_action_v1" });
  await game.act(1, choose(4));
  await game.act(2, null);
  await game.act(3, choose(4));
  expect(game.ability.uses).toBe(1);
  for (const invalid of [
    { repeatPolicy: "future" },
    { repeatPolciy: "netease_consecutive_nights_v1" },
    { selfGuard: false },
  ]) {
    expect(() =>
      parseBoardDefinition({
        ...game.definition,
        roles: { ...game.definition.roles, guard: invalid },
      }),
    ).toThrow("board_config_invalid_field");
  }
});
