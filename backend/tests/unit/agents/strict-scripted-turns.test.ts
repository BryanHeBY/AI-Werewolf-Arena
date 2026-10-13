/**
 * Unit test checks the strict scripted provider rejects duplicate, unexpected and missing turns. Inputs are literal one-turn scripts and requests; exact original error strings and consumption assertions are the oracle. No World, recorder, transport, filesystem or model runs.
 */
import { expect, test } from "bun:test";
import { Phase, type ActionRequest } from "../../../src/core";
import { StrictScriptedPlayers, type ScriptStep } from "../../support/drivers/scripted-players";

test("strict scripts reject unexpected, duplicate and missing player turns", async () => {
  const step: ScriptStep = { actorId: 1, day: 1, stage: "day_speech", turn: 1, action: null };
  expect(() => new StrictScriptedPlayers([step, step])).toThrow("script_duplicate_step");
  const provider = new StrictScriptedPlayers([step]);
  expect(() => provider.assertConsumed()).toThrow("script_missing_requests");
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
  };
  await provider.getAction(request);
  provider.assertConsumed();
  await expect(provider.getAction(request)).rejects.toThrow("script_unexpected_request");
});
