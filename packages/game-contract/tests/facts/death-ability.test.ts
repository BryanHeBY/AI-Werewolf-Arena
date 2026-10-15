/**
 * 包级单元测试验证死亡能力事实的原有分支关联。
 * 独立字面矩阵核对能力 ID、夜次和操作字段；不补库存或授予不变量，未使用的浅层额外字段仍忽略。
 * 所选事实不会安装死亡触发器或扣资源；浏览器反射异常边界不等于 Node 敌对对象入口防护。
 */
import { expect, test } from "bun:test";
import { readDeathAbilityEventFact } from "@ai-werewolf-arena/game-contract/facts/death-ability";
const base = {
  actorId: 2,
  abilityId: "gift:gun:1",
  grantedNight: 1,
  armedOnNight: null,
  remaining: 1,
  disabled: false,
  deathExpired: false,
  operation: "granted",
};

test("all five operation branches keep only original required correlations", () => {
  for (const delta of [
    { operation: "granted", remaining: 0 },
    { operation: "armed", armedOnNight: 1 },
    { operation: "disabled", disabled: true },
    { operation: "enabled" },
    { operation: "transferred_out" },
  ]) {
    const value = { ...base, ...delta };
    expect<unknown>(readDeathAbilityEventFact("death_ability_changed", value)).toEqual({
      type: "death_ability_changed",
      ...value,
    });
  }
  expect(
    readDeathAbilityEventFact("death_ability_changed", {
      ...base,
      deathExpired: true,
      disabled: true,
      remaining: 0,
    }),
  ).not.toBeNull();
});
test("ID/night bounds and operation-specific invalid matrices stay exactly selective", () => {
  expect(
    readDeathAbilityEventFact("death_ability_changed", {
      ...base,
      actorId: Number.MAX_SAFE_INTEGER,
      grantedNight: Number.MAX_SAFE_INTEGER,
      abilityId: "a".repeat(128),
    }),
  ).not.toBeNull();
  for (const delta of [
    { actorId: 0 },
    { abilityId: "a".repeat(129) },
    { abilityId: "native:gun" },
    { abilityId: "Bad" },
    { grantedNight: 0 },
    { armedOnNight: 0 },
    { remaining: 2 },
    { disabled: "false" },
    { operation: "unknown" },
    { operation: "armed" },
    { operation: "armed", armedOnNight: 1, remaining: 0 },
    { operation: "disabled" },
    { operation: "enabled", disabled: true },
    { deathExpired: true },
    { deathExpired: true, disabled: true, remaining: 1 },
  ])
    expect(readDeathAbilityEventFact("death_ability_changed", { ...base, ...delta })).toBeNull();
});
test("unused arbitrary fields do not leave the selected fact and accessors reject without execution", () => {
  let gets = 0;
  expect<unknown>(
    readDeathAbilityEventFact("death_ability_changed", {
      ...base,
      ignored: () => true,
      day: {},
      [Symbol("unused")]: true,
    }),
  ).toEqual({ type: "death_ability_changed", ...base });
  expect(
    readDeathAbilityEventFact("death_ability_changed", {
      ...base,
      get disabled() {
        gets++;
        return false;
      },
    }),
  ).toBeNull();
  expect(gets).toBe(0);
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf: () => Date.prototype,
      ownKeys() {
        throw Error("descriptors-first");
      },
    },
  );
  expect(() => readDeathAbilityEventFact("death_ability_changed", proxy)).toThrow(
    "descriptors-first",
  );
  expect(readDeathAbilityEventFact("future_event", proxy)).toBeNull();
});
