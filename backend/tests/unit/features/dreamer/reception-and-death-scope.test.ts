/**
 * 单元测试验证摄梦接收、赠予角色观察及有界遗言作用域撤销，不提前消费资源。输入保留原 locale 矩阵、本地角色状态、明确赠予实例与受控死亡结算当前性；精确校验／隐私／状态和无迟到遗言断言是预期，不推进完整 NightPipeline 或 PhaseManager 周期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Phase,
  WinCondition,
  COMPONENT,
  type BoardConfig,
  type RoleComponent,
  type ActionRequest,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getDreamerState } from "../../../../src/game/mechanisms/roles/dreamer/ports";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../../src/game/mechanisms";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { grantNightAbility } from "../../../../src/game/mechanisms/roles/night-ability-grants";
import { sixPlayerMvpConfig as plainBoard } from "../../../../src/runtime/scenarios/six_player_mvp";
import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { ActionValidator } from "../../../../src/game/gateway/action_validator";
import { ToolValidationRuleRegistry } from "../../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { DreamNightFrame } from "../../../../src/game/mechanisms/roles/dreamer/night_frame";
import { DeathCause, type GameEvent, type RuntimeSnapshot } from "../../../../src/core";

const deck = [Role.Dreamer, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager, Role.Villager];

function config(roles = deck): BoardConfig {
  return {
    ...sixPlayerMvpConfig,
    winConditions: [WinCondition.SlaughterSide],
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((item) => item === role).length,
    })),
  };
}

const role = (game: ReturnType<typeof bootstrapGame>, id: number) =>
  game.world.getComponent(id, COMPONENT.Role)!;

function policy(game: ReturnType<typeof bootstrapGame>, board = config()) {
  return new PlayerPromptPolicy(game.world, {
    boardConfig: board,
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });
}

test("a real gateway rule revoking the night-settlement scope cannot commit late last words", async () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    events: GameEvent[] = [],
    state: RuntimeSnapshot = { day: 1, phase: Phase.Day, gameOver: false, result: null };
  let current = true;
  const gateway = new ToolGateway(
    new ActionValidator(
      new ToolValidationRuleRegistry({
        speak: () => {
          current = false;
          return null;
        },
      }),
    ),
  );
  await new DeathResolution(game.world, events, gateway, new EventRegistry(), state).resolve(
    [4],
    { 4: [DeathCause.WolfKill] },
    {
      async getAction(request) {
        expect(request.context.stage).toBe("last_words");
        return { name: "speak", args: { text: "Late last words" } };
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { dreams: new DreamNightFrame([]), nightOriginIds: [4], isCurrent: () => current },
  );
  expect(events.some((event) => event.type === "last_words_spoken")).toBe(false);
  expect(game.world.activeDeathActionCount).toBe(0);
  expect(game.world.getAliveEntityIds()).not.toContain(4);
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: a non-Dreamer with an explicitly granted dream receives the bound effect rules and last choice without a false identity`, () => {
    const fixed = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
      game = bootstrapGame(plainBoard, { fixedRoles: fixed, locale });
    grantNightAbility(
      game.world,
      5,
      {
        id: "gift:day-dream",
        kind: "dream",
        state: { lastDay: 1, lastTarget: 6, history: [{ day: 1, targetId: 6 }] },
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 2,
        maxUses: 2,
      },
      [],
    );
    const request: ActionRequest = {
      actorId: 5,
      phase: Phase.Night,
      allowedTools: ["dream"],
      context: {
        day: 2,
        stage: "dreamer",
        ability_id: "gift:day-dream",
        visible_events: [],
        turn_constraints: {},
      },
    };
    const prompt = policy(game, plainBoard).buildUser(request, {
      turnId: "t1",
      allowedTools: ["dream"],
      actionSubmissionHint: "submit",
    });
    expect(prompt).toContain(
      locale === "en" ? "Dream ability rules for this turn:" : "本轮梦能力规则：",
    );
    expect(prompt).toContain(locale === "en" ? "night-origin death shots" : "夜间来源死亡枪");
    expect(prompt).toContain('"lastTarget":6');
    expect(prompt).toContain('"lastDay":1');
    expect(prompt).not.toContain(locale === "en" ? "Your role is Dreamer" : "你的底牌是【摄梦人】");
    expect(policy(game, plainBoard).buildObservation(request).identity.role).toBe(Role.Villager);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: readonly mandatory dream reception has no target-state leak or early resource consumption`, () => {
    const game = bootstrapGame(config(), { fixedRoles: deck, locale }),
      reception = new ActionReception(game.world),
      request: ActionRequest = {
        actorId: 1,
        phase: Phase.Night,
        allowedTools: ["dream"],
        context: {
          day: 1,
          stage: "dreamer",
          ability_id: "native:dream",
          visible_events: [],
          turn_constraints: {},
        },
      };
    expect(reception.validate(request, "dream", { target_id: 5 }).ok).toBe(true);
    for (const target_id of [1, 999, 2.5, null])
      expect(reception.validate(request, "dream", { target_id }).ok).toBe(false);
    expect(
      reception.validate({ ...request, phase: Phase.Day }, "dream", { target_id: 5 }),
    ).toMatchObject({ ok: false, error: "ability_phase" });
    expect(getDreamerState(role(game, 1))).toEqual({
      lastTarget: null,
      lastDay: null,
      history: [],
    });
    const target = policy(game).buildObservation({
      ...request,
      actorId: 5,
      allowedTools: ["speak"],
      phase: Phase.Day,
      context: { ...request.context, ability_id: undefined, stage: "day_speech" },
    });
    expect(target.ownState.dreamer).toBeUndefined();
  });
