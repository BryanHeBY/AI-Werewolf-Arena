/**
 * 单元测试用字面单一／复合死因向量，核对新增 Demon hunt／backlash 对原生死亡枪的资格；独立预期均为明确拒绝。不运行 World、阶段循环、库存解析、文件或模型。
 */
import { expect, test } from "bun:test";
import { DeathCause } from "../../../src/domain";

test("new causes deny Hunter gun, including compound causes", async () => {
  const { permitsDeathShot } = await import("../../../src/domain/deaths");
  expect(permitsDeathShot([DeathCause.DemonHunt], "awa_knife_or_exile_v1")).toBe(false);
  expect(
    permitsDeathShot([DeathCause.WolfKill, DeathCause.DemonHuntBacklash], "awa_knife_or_exile_v1"),
  ).toBe(false);
});
