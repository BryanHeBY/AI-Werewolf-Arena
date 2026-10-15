/**
 * 包级单元测试验证流光伯爵／蚀日侍女普通数据事实与接收者字段。
 * 独立字面事件核对借用能力 ID、日期边界、可空选择和精确字段；受众 ID 描述披露，不授予所述能力。
 * 不使用实际 roster、资源 owner 或效果结算器，事实通过不代表该行动可执行。
 */
import { expect, test } from "bun:test";
import {
  RADIANT_ECLIPSE_EVENT_TYPES,
  radiantEclipseAudience,
  readRadiantEclipseFact,
} from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";

test("five event identifiers keep their original frozen order", () => {
  expect(RADIANT_ECLIPSE_EVENT_TYPES).toEqual([
    "eclipse_swallowed",
    "eclipse_native_suppressed",
    "eclipse_native_restored",
    "eclipse_lease_closed",
    "radiant_shelter_chosen",
  ]);
  expect(Object.isFrozen(RADIANT_ECLIPSE_EVENT_TYPES)).toBe(true);
});
test("swallowing keeps explicit pass, villager no-ability and exact copied ability IDs", () => {
  for (const row of [
    { actorId: 2, day: 2, targetId: null, roleId: null, abilityId: null },
    { actorId: 2, day: 2, targetId: 3, roleId: "villager", abilityId: null },
    { actorId: 2, day: 2, targetId: 3, roleId: "seer", abilityId: "copy:eclipse:night:2" },
  ])
    expect<unknown>(readRadiantEclipseFact("eclipse_swallowed", row)).toEqual(row);
  const base = {
    actorId: 2,
    day: 2,
    targetId: 3,
    roleId: "seer",
    abilityId: "copy:eclipse:night:2",
  };
  for (const delta of [
    { day: 1 },
    { targetId: 2 },
    { roleId: "guard" },
    { abilityId: "copy:eclipse:night:3" },
    { abilityId: null },
    { extra: true },
  ])
    expect(readRadiantEclipseFact("eclipse_swallowed", { ...base, ...delta })).toBeNull();
});
test("suppression/restoration and audience remain notification data", () => {
  for (const type of ["eclipse_native_suppressed", "eclipse_native_restored"]) {
    const row = { playerId: 3, day: 2 };
    const fact = readRadiantEclipseFact(type, row)!;
    expect(fact).toEqual(row);
    expect(radiantEclipseAudience(type, fact)).toEqual([3]);
    expect(readRadiantEclipseFact(type, { ...row, day: 1 })).toBeNull();
    expect(readRadiantEclipseFact(type, { ...row, actorId: 2 })).toBeNull();
  }
  const lease = { actorId: 2, day: 1, targetId: null, abilityId: null, status: "aborted" };
  const fact = readRadiantEclipseFact("eclipse_lease_closed", lease)!;
  expect<unknown>(fact).toEqual(lease);
  expect(radiantEclipseAudience("eclipse_lease_closed", fact)).toEqual([]);
});
test("lease closure and shelter retain distinct day/nullable/ability conditions", () => {
  expect(
    readRadiantEclipseFact("eclipse_lease_closed", {
      actorId: 2,
      day: 2,
      targetId: 3,
      abilityId: null,
      status: "committed",
    }),
  ).not.toBeNull();
  expect(
    readRadiantEclipseFact("eclipse_lease_closed", {
      actorId: 2,
      day: 1,
      targetId: 3,
      abilityId: null,
      status: "committed",
    }),
  ).toBeNull();
  expect(
    readRadiantEclipseFact("eclipse_lease_closed", {
      actorId: 2,
      day: 2,
      targetId: null,
      abilityId: "copy:eclipse:night:2",
      status: "committed",
    }),
  ).toBeNull();
  for (const abilityId of ["native:shelter", "copy:eclipse:night:2"])
    expect(
      readRadiantEclipseFact("radiant_shelter_chosen", {
        actorId: 2,
        day: 2,
        targetId: null,
        abilityId,
      }),
    ).not.toBeNull();
  expect(
    readRadiantEclipseFact("radiant_shelter_chosen", {
      actorId: 2,
      day: 2,
      targetId: 2,
      abilityId: "native:shelter",
    }),
  ).toBeNull();
});
test("upper ID boundary, unknown types and accessor rejection remain unchanged", () => {
  expect(
    readRadiantEclipseFact("eclipse_native_restored", {
      playerId: Number.MAX_SAFE_INTEGER,
      day: 2,
    }),
  ).toBeNull();
  expect(
    readRadiantEclipseFact("eclipse_native_restored", {
      playerId: Number.MAX_SAFE_INTEGER - 1,
      day: 2,
    }),
  ).not.toBeNull();
  let reads = 0;
  const row = {
    day: 2,
    get playerId() {
      reads++;
      return 3;
    },
  };
  expect(readRadiantEclipseFact("unrelated", row)).toBeNull();
  expect(readRadiantEclipseFact("eclipse_native_restored", row)).toBeNull();
  expect(reads).toBe(0);
});
