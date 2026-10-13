/**
 * Unit tests: Seer policies use explicit target/action combinations and changed history;
 * exact schema, gateway, DTO and stock assertions check shared policy and exhausted-target
 * behavior. Inputs and expected outcomes remain the original literal or immutable-fixture
 * oracle; these module assertions invoke no model or complete-game driver.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  type BoardConfig,
  type ActionRequest,
  type GameEvent,
  type RoleComponent,
  type ToolCall,
} from "../../../../src/core";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { SEER_NIGHT_STAGES } from "../../../../src/game/mechanisms/roles/seer/night_stages";
import { SEER_ROLE_PROFILE } from "../../../../src/game/mechanisms/roles/seer/profile";
import {
  findNightAbility,
  projectNightAbility,
} from "../../../../src/game/mechanisms/roles/abilities";
import { getDefaultTargetHintRegistry } from "../../../../src/game/mechanisms/llm/target_hint_registry";
import { getDefaultConfigRenderRegistry } from "../../../../src/game/mechanisms/prompt/config_render_registry";
import { boardConfigSchema } from "../../../../src/core/domain/board_schema";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { nightStageContext } from "../../../engine/night_stage_fixture";
import { ObservedBot } from "../../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../../src/ai/agents/providers/observed_players";

const roles = [Role.Wolf, Role.Seer, Role.Villager, Role.Guard, Role.Villager, Role.Villager];
function setup(parameters?: BoardConfig["seer"], locale: "zh-CN" | "en" = "en") {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((x) => x === role).length,
    })),
    ...(parameters ? { seer: parameters } : {}),
  };
  const resolved = parseBoardDefinition(boardDefinitionFromConfig("seer_policy", config));
  const game = bootstrapGame(resolved.config, { fixedRoles: roles, locale });
  const ability = findNightAbility(
    game.world.getComponent<RoleComponent>(2, COMPONENT.Role),
    "seer_check",
  )!;
  const events: GameEvent[] = [];
  const requests: ActionRequest[] = [];
  const act = async (day: number, target: number | null, mutate?: () => void) => {
    const factory = new GameActionRequestFactory(game.world, events, day);
    await SEER_NIGHT_STAGES[0].execute(
      nightStageContext({
        world: game.world,
        events,
        currentDay: () => day,
        makeRequest: (actorId, allowedTools, extra) =>
          factory.create({
            actorId,
            allowedTools,
            phase: Phase.Night,
            stage: extra.stage,
            context: extra,
            requiresAction: extra.requiresAction ?? false,
            summary: "Offline policy",
          }),
        actionProvider: {
          async getAction(request) {
            requests.push(request);
            mutate?.();
            return target === null ? null : { name: "check_identity", args: { target_id: target } };
          },
        },
      }),
    );
  };
  return { ...game, ...resolved, ability, events, requests, act };
}
for (const targetPolicy of ["awa_alive_v1", "awa_fresh_others_v1"] as const)
  for (const actionPolicy of ["awa_optional_v1", "awa_required_when_legal_v1"] as const)
    test(`${targetPolicy}/${actionPolicy}: real stage, gateway, normalized schema and DTO agree`, async () => {
      const game = setup({ targetPolicy, actionPolicy });
      expect(game.config.seer).toEqual({ targetPolicy, actionPolicy });
      expect(boardConfigSchema.parse(JSON.parse(JSON.stringify(game.config))).seer).toEqual(
        game.config.seer,
      );
      expect(
        parseBoardDefinition(boardDefinitionFromConfig("seer_policy", game.config)).config.seer,
      ).toEqual(game.config.seer);
      await game.act(1, 1);
      expect(game.requests[0].context.turn_constraints.min_valid_actions).toBe(
        actionPolicy === "awa_required_when_legal_v1" ? 1 : 0,
      );
      expect(game.ability.state.history).toHaveLength(1);
      await game.act(2, 1);
      expect(game.ability.state.history).toHaveLength(
        targetPolicy === "awa_fresh_others_v1" ? 1 : 2,
      );
      await game.act(3, 2);
      expect(game.ability.state.history.some((row) => row.targetId === 2)).toBe(
        targetPolicy === "awa_alive_v1",
      );
      const projected = projectNightAbility(game.ability, 4);
      if (projected.kind !== "seer_check") throw new Error("expected_seer_projection");
      expect<unknown>(projected.state.history).toEqual(game.ability.state.history);
      if (targetPolicy === "awa_fresh_others_v1")
        expect(projected.state.targetPolicy).toBe(targetPolicy);
      const hint = getDefaultTargetHintRegistry().buildActionableIdsHint({
        world: game.world,
        actorId: 2,
        actorRole: Role.Seer,
        day: 4,
        abilityId: game.ability.id,
        allowedTools: ["check_identity"],
      })!;
      const ids = hint.match(/\b\d+\b/g)?.map(Number) ?? [];
      expect(ids.includes(1)).toBe(targetPolicy === "awa_alive_v1");
    });

test("fresh target policy rechecks history after await and exhausts without an impossible forced request", async () => {
  const game = setup({
    targetPolicy: "awa_fresh_others_v1",
    actionPolicy: "awa_required_when_legal_v1",
  });
  await game.act(1, 1, () =>
    (
      game.ability.state.history as {
        targetId: import("@ai-werewolf-arena/game-contract").EntityId;
        isWerewolf: boolean;
        result?: import("@ai-werewolf-arena/game-contract").InspectionResult;
      }[]
    ).push({ targetId: 1, isWerewolf: true }),
  );
  expect(game.events.filter((event) => event.type === "seer_checked")).toHaveLength(0);
  for (const targetId of [3, 4, 5, 6])
    (
      game.ability.state.history as {
        targetId: import("@ai-werewolf-arena/game-contract").EntityId;
        isWerewolf: boolean;
        result?: import("@ai-werewolf-arena/game-contract").InspectionResult;
      }[]
    ).push({ targetId, isWerewolf: false });
  await game.act(2, 3);
  expect(game.requests).toHaveLength(1);
  expect(game.ability.lastUsedDay).toBeNull();
  const factory = new GameActionRequestFactory(game.world, game.events, 3);
  const req = factory.create({
    actorId: 2,
    allowedTools: ["check_identity"],
    phase: Phase.Night,
    stage: "seer",
    context: { ability_id: game.ability.id },
    requiresAction: false,
    summary: "Exhausted",
  });
  const role = game.world.getComponent<RoleComponent>(2, COMPONENT.Role)!;
  expect(
    SEER_ROLE_PROFILE.baselineAction!(
      role,
      req,
      () => 1,
      () => 1,
      "en",
      game.world,
    ),
  ).toBeNull();
  const provider = new ObservedPlayersActionProvider(
    game.world,
    new Map([[2, new ObservedBot({ next: () => 0 }, "active")]]),
    game.config,
  );
  await expect(provider.getAction(req)).resolves.toBeNull();
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: named AWA policies are visible in role and board prompts`, () => {
    const game = setup(
      { targetPolicy: "awa_fresh_others_v1", actionPolicy: "awa_required_when_legal_v1" },
      locale,
    );
    const prompt = SEER_ROLE_PROFILE.renderPrompt!(
      game.world.getComponent<RoleComponent>(2, COMPONENT.Role)!,
      locale,
    );
    const board = getDefaultConfigRenderRegistry().renderBoardConfigPrompt(game.config, locale);
    expect(prompt).toContain(locale === "en" ? "history never resets" : "不重置历史");
    expect(board).toContain(
      locale === "en" ? "required while a legal target" : "存在合法目标时必须",
    );
  });

test("seer policy rejects unknown versions and parameters without that role", () => {
  const game = setup();
  const raw = boardDefinitionFromConfig("seer_policy", game.config);
  expect(() =>
    parseBoardDefinition({
      ...raw,
      roles: { ...raw.roles, seer: { targetPolicy: "global_no_repeat" } },
    }),
  ).toThrow();
  expect(() =>
    parseBoardDefinition({
      ...raw,
      board: {
        ...raw.board,
        roleSetups: raw.board.roleSetups.map((row) =>
          row.role === "seer" ? { role: "villager", count: row.count } : row,
        ),
      },
      roles: { seer: { targetPolicy: "awa_fresh_others_v1" } },
    }),
  ).toThrow();
});
