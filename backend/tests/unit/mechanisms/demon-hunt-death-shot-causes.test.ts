/**
 * Unit test checks new Demon hunt/backlash causes against native death-shot qualification. Inputs are literal single/compound cause vectors; explicit false permission expectations are the oracle. No World, phase cycle, stock parser, file or model runs.
 */
import { expect, test } from "bun:test";
import { DeathCause } from "../../../src/core";

test("new causes deny Hunter gun, including compound causes", async () => {
  const { permitsDeathShot } = await import("../../../src/core/domain/deaths");
  expect(permitsDeathShot([DeathCause.DemonHunt], "awa_knife_or_exile_v1")).toBe(false);
  expect(
    permitsDeathShot([DeathCause.WolfKill, DeathCause.DemonHuntBacklash], "awa_knife_or_exile_v1"),
  ).toBe(false);
});
