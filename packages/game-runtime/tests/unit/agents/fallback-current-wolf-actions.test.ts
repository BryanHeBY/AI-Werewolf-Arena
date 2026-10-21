/**
 * 单元测试验证 F01 自身当前狼队资格与受限回退。输入为手写 DTO、注入政策及原六席 World；
 * 独立字面动作、null、冻结与 RNG 调用计数是预期，不读对手库存作为策略输入。
 * SDK／ACP 接入由原四个有限 case 验证；这里不运行模型、物理传输、完整对局或生成新 golden。
 */
import { expect, test } from "bun:test";
import {
  Camp,
  Phase,
  Role,
  type ActionRequest,
  type ToolName,
} from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import { createRandom, type RandomSource } from "../../../src/domain/random";
import {
  createRoleCatalog,
  getDefaultRoleContributions,
} from "../../../src/rulesets/roles/role-catalog-assembly";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/rulesets/mechanism-api";
import { capturePlayerObservation } from "../../../src/agents/observation/player-observation-projector";
import {
  freezeObservation,
  type PlayerObservation,
} from "../../../src/agents/observation/player-observation";
import { PlayerPromptPolicy } from "../../../src/agents/player/player-prompt-policy";
import { ObservationFallbackStrategy } from "../../../src/agents/providers/observation-fallback";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

function request(allowedTools: ToolName[]): ActionRequest {
  return {
    actorId: 1,
    phase: Phase.Night,
    allowedTools,
    context: { day: 1, stage: "wolf_discussion", visible_events: [], turn_constraints: {} },
  };
}
function dto(
  allowedTools: ToolName[],
  canChat: boolean,
  canVoteForKill: boolean,
): PlayerObservation {
  return freezeObservation({
    request: request(allowedTools),
    identity: { role: Role.Wolf, camp: Camp.Wolf },
    players: [],
    knownAliveIds: [1, 2, 3],
    teammateIds: [2],
    currentWolfActions: { canChat, canVoteForKill },
    abilities: [],
    deathAbilities: [],
    ownNightActions: [],
    ownState: {},
  });
}
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: explicit current chat and knife rights are independent despite stale allowedTools`, async () => {
    const strategy = new ObservationFallbackStrategy(locale);
    expect(await strategy.decide(dto(["speak_to_wolves"], false, true))).toBeNull();
    expect(await strategy.decide(dto(["kill_vote"], true, false))).toBeNull();
    expect(await strategy.decide(dto(["speak_to_wolves"], true, false))).toEqual({
      name: "speak_to_wolves",
      args: {
        text:
          locale === "en"
            ? "No further suggestions from me; please continue."
            : "暂时没有补充，你们继续讨论。",
        end_chat: true,
      },
    });
    expect(await strategy.decide(dto(["kill_vote"], false, true))).toEqual({
      name: "kill_vote",
      args: { target_id: 3, abstain: false },
    });
    expect(await strategy.decide(dto(["speak_to_wolves", "kill_vote"], false, true))).toEqual({
      name: "kill_vote",
      args: { target_id: 3, abstain: false },
    });
    expect(await strategy.decide(dto([], true, true))).toBeNull();
  });

test("only literal true permits a wolf fallback; non-wolf tools retain their original order", async () => {
  const strategy = new ObservationFallbackStrategy("en");
  expect(
    await strategy.decide(dto(["speak_to_wolves"], "false" as unknown as boolean, true)),
  ).toBeNull();
  expect(await strategy.decide(dto(["kill_vote"], true, 1 as unknown as boolean))).toBeNull();
  expect(await strategy.decide(dto(["choose_direction"], false, false))).toEqual({
    name: "choose_direction",
    args: { direction: "counter_clockwise" },
  });
});

const roles = [Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer, Role.Guard];
function fixture(canChat: boolean, canVoteForKill: boolean) {
  const draws: string[] = [];
  const track = (source: RandomSource): RandomSource => ({
    metadata: source.metadata,
    next: () => {
      draws.push(source.metadata.path.join("/"));
      return source.next();
    },
    fork: (name) => track(source.fork(name)),
  });
  const random = track(createRandom("F01-own-permission")),
    game = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles, random }),
    catalog = createRoleCatalog({
      contributions: getDefaultRoleContributions().map((entry) =>
        entry.metadata.role === Role.Wolf
          ? {
              ...entry,
              runtime: {
                ...entry.runtime,
                wolfTeam: {
                  recognizedByPack: true,
                  recognizes: "pack" as const,
                  canChat,
                  canVoteForKill,
                },
              },
            }
          : entry,
      ),
    });
  const policy = new PlayerPromptPolicy(game.world, {
    roleCatalog: catalog,
    boardConfig: sixPlayerMvpConfig,
    configRenderRegistry: getDefaultConfigRenderRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
  });
  return { ...game, policy, random, catalog, draws };
}

test("real capture publishes only the actor's two frozen rights; hidden opponent death stays a knowledge candidate", () => {
  const first = fixture(true, false),
    second = fixture(true, false);
  second.world.getComponent(3, COMPONENT.Alive)!.alive = false;
  (second.world.getComponent(3, COMPONENT.Role)!.privateState as Record<string, unknown>).secret =
    "FORBIDDEN_OPPONENT_STATE";
  const firstBefore = [...first.draws],
    secondBefore = [...second.draws];
  const a = first.policy.buildObservation(request(["speak_to_wolves", "kill_vote"])),
    b = second.policy.buildObservation(request(["speak_to_wolves", "kill_vote"]));
  expect(a.currentWolfActions).toEqual({ canChat: true, canVoteForKill: false });
  expect(b).toEqual(a);
  expect(b.knownAliveIds).toEqual([1, 2, 3, 4, 5, 6]);
  expect(Object.keys(b.currentWolfActions)).toEqual(["canChat", "canVoteForKill"]);
  expect(Object.isFrozen(b.currentWolfActions)).toBe(true);
  expect(JSON.stringify(b)).not.toContain("FORBIDDEN_OPPONENT_STATE");
  // 观察不消耗根流或任何 fork 的实际 next；不同 namespace 的绘制也计入同一测试日志。
  first.policy.buildObservation(request(["kill_vote"]));
  expect(first.draws).toEqual(firstBefore);
  expect(second.draws).toEqual(secondBefore);
});

test("a dead actor cannot regain either wolf action through old tools or teammate knowledge", async () => {
  const f = fixture(true, true);
  expect(f.policy.buildObservation(request(["kill_vote"])).currentWolfActions).toEqual({
    canChat: true,
    canVoteForKill: true,
  });
  f.world.getComponent(1, COMPONENT.Alive)!.alive = false;
  const observation = f.policy.buildObservation(request(["speak_to_wolves", "kill_vote"]));
  expect(observation.currentWolfActions).toEqual({ canChat: false, canVoteForKill: false });
  expect(observation.teammateIds).toEqual([2]);
  expect(observation.knownAliveIds).toContain(1);
  expect(await new ObservationFallbackStrategy("en").decide(observation)).toBeNull();
});

test("a trusted permission callback cannot leave stale true flags after changing its own actor", () => {
  for (const change of ["role", "camp", "alive"] as const) {
    const f = fixture(true, true);
    const catalog = createRoleCatalog({
      contributions: getDefaultRoleContributions().map((entry) =>
        entry.metadata.role === Role.Wolf
          ? {
              ...entry,
              runtime: {
                ...entry.runtime,
                wolfTeam: () => {
                  // 测试自有闭包显式持本局写权；公开贡献参数不再隐式取得 World 或角色组件。
                  if (change === "role")
                    f.world.getComponent(1, COMPONENT.Role)!.role = Role.Villager;
                  if (change === "camp") f.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Good;
                  if (change === "alive") f.world.getComponent(1, COMPONENT.Alive)!.alive = false;
                  return {
                    recognizedByPack: true,
                    recognizes: "pack" as const,
                    canChat: true,
                    canVoteForKill: true,
                  };
                },
              },
            }
          : entry,
      ),
    });
    const observation = capturePlayerObservation(request(["kill_vote"]), {
      world: () => f.world,
      role: (actorId) => f.world.getComponent(actorId(), COMPONENT.Role),
      wolfTeammates: () => [],
      catalog: () => catalog,
    });
    expect(observation.currentWolfActions).toEqual({ canChat: false, canVoteForKill: false });
  }
});
