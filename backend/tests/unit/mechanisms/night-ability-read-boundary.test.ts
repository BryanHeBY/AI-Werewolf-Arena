/**
 * 单元测试：验证七种 live 能力只读契约及具体写入 owner。
 * 输入为字面安装数据、存储引用和带记录的 getter；身份、getter trace 与部分写入是独立预期。
 * 编译期合法形状写操作必须被查询／native 读输出拒绝；实际安装／use 归同一实例 owner。
 * 不执行对局、模型或传输，不从生产输出生成期望结果。
 */
import type { NightAbilityStates } from "@ai-werewolf-arena/game-contract";

import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { Camp, Role, WitchSelfHealRule } from "@ai-werewolf-arena/game-contract";
import { type RoleComponent } from "../../../src/domain/components/role";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";
import {
  activeNightAbility,
  allNightAbilities,
  findNightAbility,
  type NightAbilityReadView,
} from "../../../src/features/night-abilities/abilities";
import { installNativeAbility } from "../../../src/features/night-abilities/ability-changes";
import { recordNightAbilityUse, setNightAbilityStartDay } from "../../../src/features/night-abilities/abilities";
import {
  createNightAbilityActorQuery,
  type NightAbilityActorQuery,
} from "../../../src/features/night-abilities/night-ability-actors";
import { getWitchState } from "../../../src/features/witch/ports";
import {
  getRoleInspectionState,
  recordAbilityRoleInspection,
} from "../../../src/features/role-inspection/ports";

function rejectedLiveWrites(
  role: RoleComponent,
  actors: NightAbilityActorQuery,
  pair: NightAbilityReadView<"pair_check">,
  shelter: NightAbilityReadView<"shelter">,
  seer: NightAbilityReadView<"seer_check">,
  inspection: NightAbilityReadView<"role_check">,
  guard: NightAbilityReadView<"guard">,
  potion: NightAbilityReadView<"potion">,
  dream: NightAbilityReadView<"dream">,
) {
  // @ts-expect-error Fresh query membership does not grant live metadata writes.
  allNightAbilities(role)[0]!.uses++;
  // @ts-expect-error 原生优先选择仅公开实时只读权限。
  findNightAbility(role, "guard")!.disabled = true;
  // @ts-expect-error Active selection also grants no start-day mutation.
  activeNightAbility(role, "potion", 1)!.startsOnDay = 2;
  // @ts-expect-error Captured actor output keeps identity without stock write rights.
  actors.actors("potion", 1)[0]!.ability.state.poison = 0;
  // @ts-expect-error Captured actor output has no metadata write route.
  actors.actors("guard", 1)[0]!.ability.uses++;
  if (seer.source.kind === "gift") {
    // @ts-expect-error The valid gift actor ID cannot be edited through a read alias.
    seer.source.actorId = 7;
  }
  // @ts-expect-error Source metadata remains read-only below the instance.
  seer.source.kind = "native";
  // @ts-expect-error The temporary blocker is read-only below the instance.
  seer.nightSuppression!.day = 3;
  // @ts-expect-error Pair result rows are read-only.
  pair.state.history[0]!.containsWerewolf = false;
  // @ts-expect-error The nested pair tuple cannot be used as a write path.
  pair.state.history[0]!.targetIds[0] = 3;
  // @ts-expect-error Shelter's finite scalar payload is read-only.
  shelter.state.lastDay = 2;
  // @ts-expect-error Seer history cannot be appended through a query.
  seer.state.history.push({ targetId: 2, isWerewolf: false });
  if (seer.state.lastResult?.kind === "camp") {
    // @ts-expect-error The nullable last result is itself read-only.
    seer.state.lastResult.camp = "good";
  }
  if (seer.state.history[0]?.result?.kind === "camp") {
    // @ts-expect-error Nested historical inspection results are read-only.
    seer.state.history[0].result.camp = "good";
  }
  // @ts-expect-error Role-inspection results are read-only below their history row.
  inspection.state.history[0]!.result.role = Role.Wolf;
  // @ts-expect-error Role-inspection history cannot be appended.
  inspection.state.history.push({ day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } });
  // @ts-expect-error Guard policy is read-only as well as its already-read-only target.
  guard.state.repeatPolicy = "awa_last_action_v1";
  // @ts-expect-error Witch bottles cannot be decremented by a reader.
  potion.state.heal--;
  // @ts-expect-error Dreamer history rows are read-only.
  dream.state.history[0]!.targetId = 2;
  // @ts-expect-error Dreamer history membership is read-only.
  dream.state.history.push({ day: 1, targetId: 2 });
  // @ts-expect-error 原生 getter 返回同一只读视图，不提供可写出口。
  getWitchState(role)!.poison = 0;
  // @ts-expect-error 原生角色查验 getter 也保持嵌套结果只读。
  getRoleInspectionState(role)!.history[0]!.result.role = Role.Wolf;
  const data: NightAbilityStates["potion"] = {
    heal: 1,
    poison: 1,
    selfHealRule: WitchSelfHealRule.Disabled,
    canSelfHeal: false,
    healUsedThisNight: false,
    poisonUsedThisNight: false,
  };
  data.poison = 0; // Installation DTO retains its existing writable fields.
  // @ts-expect-error A native install returns a stored read alias, not its writable input DTO.
  installNativeAbility(role, "potion", data).poison = 0;
}
void rejectedLiveWrites;

test("installation copies input while all/find/active return the same unfrozen stored references", () => {
  const role = createRoleComponent(Role.Seer),
    input: NightAbilityStates["seer_check"] = {
      lastTarget: null,
      lastIsWerewolf: null,
      lastResult: null,
      history: [],
    },
    installed = installNativeAbility(role, "seer_check", input),
    selected = findNightAbility(role, "seer_check")!;
  expect(installed).not.toBe(input);
  expect(selected.state).toBe(installed);
  expect(allNightAbilities(role)[0]).toBe(selected);
  expect(activeNightAbility(role, "seer_check", 1)).toBe(selected);
  input.history.push({ targetId: 4, isWerewolf: false });
  expect(installed.history).toEqual([]);
  expect(Object.isFrozen(selected)).toBe(false);
  expect(Object.isFrozen(installed)).toBe(false);
});

test("actor enumeration exposes the same read alias and existing metadata commands update that instance", () => {
  const role = createRoleComponent(Role.Seer);
  installNativeAbility(role, "seer_check", { lastTarget: null, lastIsWerewolf: null, history: [] });
  const selected = findNightAbility(role, "seer_check")!,
    query = createNightAbilityActorQuery(
      { aliveIds: () => [3], abilitiesFor: () => allNightAbilities(role) },
      { filterAliveActors: (ids) => [...ids] },
    );
  expect(query.actors("seer_check", 1)[0]!.ability).toBe(selected);
  setNightAbilityStartDay(selected, 2);
  expect(query.actors("seer_check", 1)).toEqual([]);
  expect(query.actors("seer_check", 2)[0]!.ability).toBe(selected);
  recordNightAbilityUse(selected, 2, true);
  expect(selected.uses).toBe(1);
  expect(selected.lastUsedDay).toBe(2);
  expect(query.actors("seer_check", 2)).toEqual([]);
});

function inspectionWithGetter(
  state: NightAbilityStates["role_check"],
  trace: string[],
  failAt?: number,
): NightAbilityReadView<"role_check"> {
  let reads = 0;
  return {
    id: "native:role_check",
    kind: "role_check",
    get state() {
      trace.push(`state:${++reads}`);
      if (reads === failAt) throw new Error("original_state_read_failure");
      return state;
    },
    source: { kind: "native", role: Role.PureWhiteGirl },
    sourceDisclosed: true,
    startsOnDay: 1,
    maxUses: null,
    uses: 0,
    lastUsedDay: null,
    disabled: false,
  };
}

test("Pure White's concrete writer retains three state reads and one copied result append", () => {
  const state: NightAbilityStates["role_check"] = { lastTarget: null, lastDay: null, history: [] },
    trace: string[] = [],
    result = { kind: "role" as const, role: Role.Wolf };
  recordAbilityRoleInspection(inspectionWithGetter(state, trace), 7, 2, result);
  expect(trace).toEqual(["state:1", "state:2", "state:3"]);
  expect(state).toEqual({ lastTarget: 7, lastDay: 2, history: [{ day: 2, targetId: 7, result }] });
  expect(state.history[0]!.result).not.toBe(result);
});

test("the second state getter failure retains the original first write without history or refund", () => {
  const state: NightAbilityStates["role_check"] = { lastTarget: null, lastDay: null, history: [] },
    trace: string[] = [];
  expect(() =>
    recordAbilityRoleInspection(inspectionWithGetter(state, trace, 2), 7, 2, {
      kind: "role",
      role: Role.Wolf,
    }),
  ).toThrow("original_state_read_failure");
  expect(trace).toEqual(["state:1", "state:2"]);
  expect(state).toEqual({ lastTarget: 7, lastDay: null, history: [] });
});
