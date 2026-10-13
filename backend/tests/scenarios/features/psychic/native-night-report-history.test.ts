/**
 * 通灵师场景验证完整夜重入及梦／魅惑死亡链保留判胜前私有历史。输入为原 pass 矩阵、固定角色与受控 Pipeline／经理；手写报告、库存、死亡隐私和事实结果是预期。Catalog 查询仍返回原缓存贡献引用，不复制 authority。
 */
import { nightStageContext } from "../../../support/builders/night-stage-context";
import { PotionType } from "../../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp,
  Role,
  Phase,
  WinCondition,
  COMPONENT,
  type BoardConfig,
  type RoleComponent,
  type GameEvent,
  type ActionRequest,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getRoleInspectionState } from "../../../../src/game/mechanisms/roles/role_inspection/ports";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import { PSYCHIC_INSPECTION_STAGE } from "../../../../src/game/mechanisms/roles/role_inspection/night_stages";
import { hasRoleInspectionNightCommit } from "../../../../src/game/mechanisms/roles/role_inspection/night_scope";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";

const deck = [Role.Psychic, Role.Wolf, Role.Witch, Role.Guard, Role.Villager, Role.Villager],
  catalog = getDefaultRoleCatalog();

const board = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  winConditions: [WinCondition.SlaughterSide],
  selfDestruct: { enabledWindows: [] },
});

const role = (game: ReturnType<typeof bootstrapGame>, actor: number) =>
  game.world.getComponent(actor, COMPONENT.Role)!;

function context(
  game: ReturnType<typeof bootstrapGame>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
  day = 1,
  clock = () => true,
): NightStageContext {
  const requests = new GameActionRequestFactory(game.world, events, day);
  return nightStageContext({
    world: game.world,
    events,
    roleCatalog: catalog,
    toolGateway: new ToolGateway(),
    isCurrent: clock,
    currentDay: () => day,
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      requests.create({
        summary: "Offline stage fixture",
        actorId,
        phase: Phase.Night,
        allowedTools,
        stage: extra.stage,
        requiresAction: extra.requiresAction ?? true,
        context: extra,
      }),
    getAliveByRole: () => [],
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      dreamLinks: [],
    },
  });
}

for (const pass of [false, true])
  test(`${pass}: actual complete NightPipeline rejects same World/day reentry, keeping another World usable`, async () => {
    const { NightPipeline } =
        await import("../../../../src/game/engine/phase_pipeline/night_pipeline"),
      { DamageResolutionSystem } =
        await import("../../../../src/core/domain/systems/damage_resolution_system"),
      { BaselineBotActionProvider } =
        await import("../../../../src/ai/agents/providers/action_providers");
    const game = bootstrapGame(board(), { fixedRoles: deck }),
      events: GameEvent[] = [],
      bot = new BaselineBotActionProvider(game.world),
      pipeline = new NightPipeline({
        world: game.world,
        events,
        toolGateway: new ToolGateway(),
        damageResolutionSystem: new DamageResolutionSystem(),
      });
    let calls = 0;
    const provider = {
      async getAction(request: ActionRequest) {
        if (request.context.stage === "psychic") {
          calls++;
          return pass ? null : { name: "inspect_role" as const, args: { target_id: 2 } };
        }
        return bot.getAction(request);
      },
    };
    await pipeline.execute(board(), provider, 1);
    const before = structuredClone({ events, state: role(game, 1).privateState });
    await expect(pipeline.execute(board(), provider, 1)).rejects.toThrow(
      "role_inspection_night_reentry_after_commit",
    );
    expect(calls).toBe(1);
    expect({ events, state: role(game, 1).privateState }).toEqual(before);
    const other = bootstrapGame(board(), { fixedRoles: deck });
    expect(hasRoleInspectionNightCommit(other.world, 1)).toBe(false);
    await PSYCHIC_INSPECTION_STAGE.execute(context(other, [], async () => null));
    expect(findNightAbility(role(other, 1), "role_check")!.lastUsedDay).toBe(1);
  });

test("Dream protects the acting Spirit Seer, then consecutive dream death settles after a second valid inspection and before judgment", async () => {
  const fixed = [Role.Wolf, Role.Wolf, Role.Psychic, Role.Dreamer, Role.Villager, Role.Villager],
    game = bootstrapGame(board(fixed), { fixedRoles: fixed });
  let day = 1;
  const provider = {
    async getAction(request: ActionRequest) {
      if (request.allowedTools.includes("dream"))
        return { name: "dream" as const, args: { target_id: 3 } };
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves" as const, args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return {
          name: "kill_vote" as const,
          args: { target_id: day === 1 ? 3 : 6, abstain: false },
        };
      if (request.allowedTools.includes("inspect_role"))
        return { name: "inspect_role" as const, args: { target_id: day === 1 ? 1 : 2 } };
      if (request.allowedTools.includes("speak"))
        return { name: "speak" as const, args: { text: "Raw" } };
      if (request.allowedTools.includes("vote"))
        return { name: "vote" as const, args: { target_id: day === 1 ? 1 : 2, abstain: false } };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  };
  await game.phaseManager.runSingleCycle(provider);
  expect(game.world.getAliveEntityIds()).toEqual([2, 3, 4, 5, 6]);
  day = 2;
  await game.phaseManager.runSingleCycle(provider);
  expect(game.world.getAliveEntityIds()).toEqual([4, 5]);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  expect(getRoleInspectionState(role(game, 3))!.history).toEqual([
    { day: 1, targetId: 1, result: { kind: "role", role: Role.Wolf } },
    { day: 2, targetId: 2, result: { kind: "role", role: Role.Wolf } },
  ]);
  expect(
    game.phaseManager
      .getEvents()
      .filter((e) => e.type === "dream_death")
      .map((e) => e.payload),
  ).toContainEqual({ actorId: 4, targetId: 3, day: 2, reason: "consecutive" });
});

test("a private Spirit Seer report survives the later actual Beauty charm death without granting knowledge to other players", async () => {
  const fixed = [
      Role.WolfBeauty,
      Role.Wolf,
      Role.Psychic,
      Role.Witch,
      Role.Villager,
      Role.Villager,
    ],
    game = bootstrapGame(board(fixed), { fixedRoles: fixed });
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 6, abstain: false } };
      if (request.allowedTools.includes("charm")) return { name: "charm", args: { target_id: 3 } };
      if (request.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 4, potion_type: PotionType.None } };
      if (request.allowedTools.includes("inspect_role"))
        return { name: "inspect_role", args: { target_id: 1 } };
      if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
      if (request.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: 1, abstain: false } };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  });
  expect(game.world.getAliveEntityIds()).toEqual([2, 4, 5]);
  expect(game.phaseManager.getSnapshot().gameOver).toBe(false);
  expect(getRoleInspectionState(role(game, 3))!.history).toEqual([
    { day: 1, targetId: 1, result: { kind: "role", role: Role.WolfBeauty } },
  ]);
  const events = game.phaseManager.getEvents();
  expect(events.findIndex((e) => e.type === "role_inspected")).toBeLessThan(
    events.findIndex((e) => e.type === "charm_death"),
  );
  for (const id of game.world.entityIds())
    expect(
      buildAgentVisibleEventFeed(game.world, events, id).filter((e) => e.type === "role_inspected"),
    ).toHaveLength(id === 3 ? 1 : 0);
});
