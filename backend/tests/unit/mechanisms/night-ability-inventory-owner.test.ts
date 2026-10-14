/**
 * 单元测试验证共同库存的原生安装与空字典失败前缀，以及真实蚀日侍女初始化的先后顺序。
 * 输入是独立角色、字面库存和本例自有 getter／setter；输出为手写读取轨迹、同一错误和原对象引用。
 * 只调用实际 owner 与真实初始化贡献，不运行对局、模型或归档；库存数据不等于行动许可。
 * 旧 use／借用／转移反例另按精准用例验证，不在这里复制实现或改变 F03 的已知失败政策。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import type { RoleInitializationComponent } from "../../../src/game/mechanisms/roles/contracts";
import {
  commitPreparedNativeAbility,
  findNightAbility,
  type NightAbility,
} from "../../../src/game/mechanisms/roles/abilities";
import { ECLIPSE_MAID_ROLE_PROFILE } from "../../../src/game/mechanisms/roles/radiant_eclipse/profile";
import * as legacyMetadata from "../../../src/game/mechanisms/roles/ability_changes";
import * as publicMechanisms from "../../../src/game/mechanisms";

function retiredMetadataAndInternalRootExports() {
  // @ts-expect-error 通用 metadata 完整实现已归共同库存 owner，旧准备叶无转发。
  void legacyMetadata.setNightAbilityEnabled;
  // @ts-expect-error 借用退役写入同样退出旧准备叶。
  void legacyMetadata.retireBorrowedNightAbility;
  // @ts-expect-error 首次死亡到期命令由共同库存直接维护。
  void legacyMetadata.expireLuckyAbilitiesOnDeath;
  // @ts-expect-error 起效日的实际写命令不再从旧准备叶公开。
  void legacyMetadata.setNightAbilityStartDay;
  // @ts-expect-error 次数与 lastUsedDay 的写命令没有旧叶兼容出口。
  void legacyMetadata.recordNightAbilityUse;
  // @ts-expect-error 已准备的原生提交是实际内部消费者接口，不扩大机制根公开 API。
  void publicMechanisms.commitPreparedNativeAbility;
  // @ts-expect-error 原授予政策仍负责准入，原始字典提交不经根出口公开。
  void publicMechanisms.commitGrantedNightAbility;
  // @ts-expect-error 原转移政策仍负责准入，退休提交尾不经根出口公开。
  void publicMechanisms.retireTransferredNightAbility;
  // @ts-expect-error 清空仅服务原蚀日侍女初始化，不新增根级任意库存重置入口。
  void publicMechanisms.initializeNightAbilityInventory;
}
void retiredMetadataAndInternalRootExports;

test("native retired-ID getter failure keeps the already-created empty dictionary", () => {
  const role = createRoleComponent(Role.Guard, Camp.Good),
    failure = Error("literal_native_retired_getter_failed"),
    trace: string[] = [],
    owned = { lastTarget: null };
  Object.defineProperty(role.privateState, "retiredAbilityIds", {
    configurable: true,
    get() {
      trace.push("retired:get");
      throw failure;
    },
  });
  let caught: unknown;
  try {
    commitPreparedNativeAbility(role, "guard", owned);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["retired:get"]);
  const dictionary = Object.getOwnPropertyDescriptor(role.privateState, "abilities")!;
  expect(dictionary.value).toEqual({});
  expect(dictionary.writable).toBe(true);
  expect(owned).toEqual({ lastTarget: null });
});

test("a native source conflict preserves the stored instance, payload and counters", () => {
  const role = createRoleComponent(Role.Guard, Camp.Good),
    state = { lastTarget: 3 },
    replacement = { lastTarget: null };
  const existing: NightAbility<"guard"> = {
    id: "native:guard",
    kind: "guard",
    state,
    source: { kind: "native", role: Role.Seer },
    sourceDisclosed: true,
    startsOnDay: 7,
    maxUses: 2,
    uses: 1,
    lastUsedDay: 6,
    disabled: false,
  };
  const dictionary = { "native:guard": existing };
  Object.defineProperty(role.privateState, "abilities", { value: dictionary });
  expect(() => commitPreparedNativeAbility(role, "guard", replacement)).toThrow(
    "ability_native_binding_conflict",
  );
  expect(findNightAbility(role, "guard")).toBe(existing);
  expect(existing.state).toBe(state);
  expect(existing.source).toEqual({ kind: "native", role: Role.Seer });
  expect([existing.startsOnDay, existing.maxUses, existing.uses, existing.lastUsedDay]).toEqual([
    7, 2, 1, 6,
  ]);
  expect(Object.getOwnPropertyDescriptor(role.privateState, "abilities")!.value).toBe(dictionary);
  expect(replacement).toEqual({ lastTarget: null });
});

test("Eclipse initialization retains its preceding state installation when dictionary clearing fails", () => {
  const role = createRoleComponent(Role.EclipseMaid, Camp.Wolf) as RoleInitializationComponent,
    failure = Error("literal_eclipse_dictionary_setter_failed"),
    previous = { "gift:old": { remaining: 1 } },
    trace: string[] = [];
  let installed: unknown;
  Object.defineProperty(role.privateState, "eclipse", {
    configurable: true,
    set(value) {
      trace.push("eclipse:set");
      installed = value;
    },
  });
  Object.defineProperty(role.privateState, "abilities", {
    configurable: true,
    get: () => previous,
    set(value) {
      trace.push("abilities:set");
      expect(value).toEqual({});
      throw failure;
    },
  });
  Object.defineProperty(role.privateState, "retiredAbilityIds", {
    get() {
      trace.push("unexpected-retired:get");
      throw Error("unexpected_retired_read");
    },
  });
  let caught: unknown;
  try {
    ECLIPSE_MAID_ROLE_PROFILE.runtime.init!(role, {});
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["eclipse:set", "abilities:set"]);
  expect(installed).toEqual({
    policy: "awa_radiant_eclipse_v1",
    history: [],
  });
  expect(role.privateState.abilities).toBe(previous);
});
