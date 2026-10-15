/**
 * 单元测试：负责普通夜能力实际安装与 metadata owner 的共享引用和付款边界。
 * 输入为原角色、字面状态、带 trace 的实例和复制故障；输出使用原错误、引用、字段及顺序预期。
 * 编译负例保证原生准备与通用库存写命令各归实际所有者，具体 payload 和业务时钟仍归原调用者。
 * 不执行阶段、模型、文件或完整对局，也不调用生产规则生成预期。
 */
import { expect, test } from "bun:test";
import { Camp, Role, type PairSeerState } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";
import * as queries from "../../../src/features/night-abilities/abilities";
import * as prepared from "../../../src/features/night-abilities/ability-changes";
import { installNativeAbility } from "../../../src/features/night-abilities/ability-changes";
import {
  setNightAbilityStartDay,
  recordNightAbilityUse,
} from "../../../src/features/night-abilities/abilities";

function removedQueryWrites() {
  // @ts-expect-error 原生安装已经退出只读查询入口。
  void queries.installNativeAbility;
  // @ts-expect-error 起效日实际写命令已退出 payload 准备叶。
  void prepared.setNightAbilityStartDay;
  // @ts-expect-error 次数实际提交已退出 payload 准备叶。
  void prepared.recordNightAbilityUse;
}
void removedQueryWrites;

test("native installation and metadata commits retain the same queried instance with the original copy", () => {
  const role = createRoleComponent(Role.Seer);
  const input = { lastTarget: null, lastIsWerewolf: null, history: [] };
  const stored = installNativeAbility(role, "seer_check", input);
  const ability = queries.findNightAbility(role, "seer_check")!;
  expect(stored).not.toBe(input);
  expect(ability.state).toBe(stored);
  expect(Object.isFrozen(stored)).toBe(false);
  setNightAbilityStartDay(ability, 2);
  expect(queries.abilityStatus(ability, 1)).toBe("pending");
  expect(queries.activeNightAbility(role, "seer_check", 2)).toBe(ability);
  recordNightAbilityUse(ability, 2, false);
  expect(ability.lastUsedDay).toBe(2);
  expect(ability.uses).toBe(0);
  expect(queries.abilityStatus(ability, 2)).toBe("used_this_night");
});

test("use accounting retains last-day payment before a throwing increment setter", () => {
  const trace: string[] = [],
    failure = new Error("original_use_increment_failure");
  let lastDay: number | null = null;
  const ability: queries.NightAbilityReadView<"guard"> = {
    id: "native:guard",
    kind: "guard",
    state: { lastTarget: null },
    source: { kind: "native", role: Role.Guard },
    sourceDisclosed: true,
    startsOnDay: 1,
    maxUses: null,
    disabled: false,
    get lastUsedDay() {
      trace.push("lastDay:get");
      return lastDay;
    },
    set lastUsedDay(day: number | null) {
      trace.push("lastDay:set:" + day);
      lastDay = day;
    },
    get uses() {
      trace.push("uses:get");
      return 0;
    },
    set uses(value: number) {
      trace.push("uses:set:" + value);
      throw failure;
    },
  };
  expect(() => recordNightAbilityUse(ability, 2, true)).toThrow(failure);
  expect(trace).toEqual(["lastDay:get", "lastDay:set:2", "uses:get", "uses:set:1"]);
  expect<number | null>(lastDay).toBe(2);
  expect(ability.state.lastTarget).toBeNull();
});

test("the original native Pair role guard precedes cloning foreign data and installing a slot", () => {
  const role = createRoleComponent(Role.Villager);
  let dataReads = 0;
  const input = {
    get policy() {
      dataReads++;
      throw new Error("copy_must_not_run");
    },
  } as unknown as PairSeerState;
  expect(() => installNativeAbility(role, "pair_check", input)).toThrow(
    "ability_pair_native_role_invalid",
  );
  expect(dataReads).toBe(0);
  expect(Object.keys(role.privateState)).toEqual([]);
});
