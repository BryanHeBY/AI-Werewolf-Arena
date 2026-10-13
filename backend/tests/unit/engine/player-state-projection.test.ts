/**
 * 单元测试：验证玩家状态投影的分离白名单及所选能力。输入为原私有历史与恶意字段；精确字段和能力相等断言拒绝未知数据／getter 进入 owner DTO，不复制运行句柄。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  WitchSelfHealRule,
  type ActionRequest,
  type RoleComponent,
} from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/game/mechanisms";
import {
  findNightAbility,
} from "../../../src/game/mechanisms/roles/abilities";
import { projectNightAbility } from "../../../src/game/observation/night-ability-projection";
import { getBearState } from "../../../src/game/mechanisms/roles/bear/ports";
import { getDreamerState } from "../../../src/game/mechanisms/roles/dreamer/ports";
import { getGuardState } from "../../../src/game/mechanisms/roles/guard/ports";
import { getHunterState } from "../../../src/game/mechanisms/roles/hunter/ports";
import { getIdiotState } from "../../../src/game/mechanisms/roles/idiot/ports";
import { getKnightState } from "../../../src/game/mechanisms/roles/knight/ports";
import { getWhiteWolfKingState } from "../../../src/game/mechanisms/roles/white_wolf_king/ports";
import { getWolfBeautyState } from "../../../src/game/mechanisms/roles/wolf_beauty/ports";
import { getWolfKingState } from "../../../src/game/mechanisms/roles/wolf_king/ports";
import {
  projectBearState,
  projectDreamerState,
  projectGuardState,
  projectHunterState,
  projectRoleInspectionState,
  projectSeerState,
  projectWitchState,
  projectWolfBeautyState,
} from "../../../src/game/mechanisms/roles/player_state";

const cases = [
  [Role.Guard, "guard"],
  [Role.Hunter, "hunter"],
  [Role.WolfKing, "wolfKing"],
  [Role.WhiteWolfKing, "whiteWolfKing"],
  [Role.Knight, "knight"],
  [Role.Idiot, "idiot"],
  [Role.Dreamer, "dreamer"],
  [Role.WolfBeauty, "wolfBeauty"],
  [Role.Bear, "bear"],
] as const;
function fixture(kind: Role, locale: "zh-CN" | "en") {
  const roles = [kind, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
  const config = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((candidate) => candidate === role).length,
    })),
  };
  const game = bootstrapGame(config, { fixedRoles: roles, locale });
  const role = game.world.getComponent(1, COMPONENT.Role)!;
  const policy = new PlayerPromptPolicy(game.world, {
    boardConfig: config,
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: { day: 2, stage: "day_speech", visible_events: [], turn_constraints: {} },
  };
  return { ...game, role, policy, request };
}
function nativeState(role: RoleComponent) {
  switch (role.role) {
    case Role.Guard:
      return getGuardState(role)!;
    case Role.Hunter:
      return getHunterState(role)!;
    case Role.WolfKing:
      return getWolfKingState(role)!;
    case Role.WhiteWolfKing:
      return getWhiteWolfKingState(role)!;
    case Role.Knight:
      return getKnightState(role)!;
    case Role.Idiot:
      return getIdiotState(role)!;
    case Role.Dreamer:
      return getDreamerState(role)!;
    case Role.WolfBeauty:
      return getWolfBeautyState(role)!;
    case Role.Bear:
      return getBearState(role)!;
    default:
      throw new Error("unsupported_projection_fixture");
  }
}
for (const locale of ["zh-CN", "en"] as const)
  for (const [kind, key] of cases)
    test(`${locale}/${kind}: own-state projection excludes unknown facts without invoking their getters`, () => {
      const game = fixture(kind, locale),
        state = nativeState(game.role),
        expected = structuredClone(state);
      let reads = 0;
      Object.defineProperty(state, "godSecret", {
        enumerable: true,
        value: "PRIVATE_REFEREE_FACT",
      });
      Object.defineProperty(state, "futureGetter", {
        enumerable: true,
        get() {
          reads++;
          throw new Error("foreign_state_accessor");
        },
      });
      const observation = game.policy.buildObservation(game.request);
      expect<unknown>(observation.ownState[key]).toEqual(expected);
      expect(JSON.stringify(observation)).not.toContain("PRIVATE_REFEREE_FACT");
      expect(JSON.stringify(observation)).not.toContain("futureGetter");
      expect(reads).toBe(0);
      expect(Object.isFrozen(observation.ownState[key])).toBe(true);
      expect(Object.getOwnPropertyDescriptor(state, "godSecret")?.value).toBe(
        "PRIVATE_REFEREE_FACT",
      );
    });

test("dream ownState and selected ability expose the same detached, valid history contract", () => {
  const game = fixture(Role.Dreamer, "en"),
    ability = findNightAbility(game.role, "dream")!;
  (ability.state as { lastTarget: number | null }).lastTarget = 5;
  (ability.state as { lastDay: number | null }).lastDay = 1;
  (
    ability.state as unknown as {
      history: { day: number; targetId: import("@ai-werewolf-arena/game-contract").EntityId }[];
    }
  ).history = [{ day: 1, targetId: 5 }];
  Object.defineProperty(ability.state.history[0], "godReason", {
    enumerable: true,
    value: "hidden",
  });
  let reads = 0;
  const invalid = { day: 2, targetId: 6 };
  Object.defineProperty(invalid, "targetId", {
    enumerable: true,
    get() {
      reads++;
      return 6;
    },
  });
  // Raw-state malformed rows test the DTO boundary independently of native typing.
  const malformed: unknown[] = [
    ability.state.history[0],
    invalid,
    { day: 0, targetId: 5 },
    { day: 2, targetId: Infinity },
    { day: 2, targetId: null },
  ];
  Object.defineProperty(malformed, "5", {
    enumerable: true,
    get() {
      reads++;
      return { day: 2, targetId: 6 };
    },
  });
  Object.defineProperty(ability.state, "history", { value: malformed, writable: true });
  const observed = game.policy.buildObservation(game.request),
    projected = observed.abilities.find((candidate) => candidate.kind === "dream");
  if (!projected || projected.kind !== "dream") throw new Error("missing_player_dream_fixture");
  if (!observed.ownState.dreamer) throw new Error("missing_own_dream_fixture");
  expect(observed.ownState.dreamer).toEqual({
    lastTarget: 5,
    lastDay: 1,
    history: [{ day: 1, targetId: 5 }],
  });
  expect(projected.state).toEqual(observed.ownState.dreamer);
  expect(projected.state.history).toEqual([{ day: 1, targetId: 5 }]);
  expect(projected.state.history).not.toBe(ability.state.history);
  expect(reads).toBe(0);
  expect(projectNightAbility(ability, 2).kind).toBe("dream");
  expect(ability.uses).toBe(0);
  expect(ability.lastUsedDay).toBeNull();
});

test("declared-state and report accessors are not executed, and invalid history rows are discarded", () => {
  let reads = 0;
  const accessor = {
    get history() {
      reads++;
      return [{ day: 1, targetId: 2 }];
    },
    get lastTarget() {
      reads++;
      return 2;
    },
    get canShoot() {
      reads++;
      return true;
    },
  };
  expect(projectDreamerState(accessor)).toEqual({ lastTarget: null, lastDay: null, history: [] });
  expect(projectGuardState(accessor)).toEqual({ lastTarget: null });
  expect(projectHunterState(accessor)).toEqual({ canShoot: false });
  expect(
    projectBearState({
      history: [
        { day: 1, roared: true, secret: "hidden" },
        { day: 2, roared: "true" },
        { day: -1, roared: false },
      ],
    }),
  ).toEqual({ history: [{ day: 1, roared: true }] });
  expect(
    projectWolfBeautyState({
      targetId: null,
      lastActedDay: 1,
      history: [
        { day: 1, targetId: null, secret: "hidden" },
        { day: 2, targetId: 0 },
      ],
    }),
  ).toEqual({ targetId: null, lastActedDay: 1, history: [{ day: 1, targetId: null }] });
  expect(
    projectSeerState({
      history: [
        { targetId: 2, isWerewolf: true, result: { kind: "camp", camp: "wolf", secret: "hidden" } },
        { targetId: 0, isWerewolf: true },
      ],
    }).history,
  ).toEqual([{ targetId: 2, isWerewolf: true, result: { kind: "camp", camp: "wolf" } }]);
  expect(
    projectRoleInspectionState({
      policy: "mirror",
      history: [
        { day: 1, targetId: 2, result: { kind: "role", role: "wolf", secret: "hidden" } },
        { day: 2, targetId: 3, result: { kind: "camp", camp: "good" } },
      ],
    }).history,
  ).toEqual([{ day: 1, targetId: 2, result: { kind: "role", role: "wolf" } }]);
  expect(
    projectWitchState({
      heal: 1,
      poison: -1,
      selfHealRule: "always",
      canSelfHeal: true,
      healUsedThisNight: false,
      poisonUsedThisNight: false,
      secret: "hidden",
    }),
  ).toEqual({
    heal: 1,
    poison: 0,
    selfHealRule: WitchSelfHealRule.Always,
    canSelfHeal: true,
    healUsedThisNight: false,
    poisonUsedThisNight: false,
  });
  expect(reads).toBe(0);
});
