/**
 * Interaction scenarios verify PhaseManager rejects Radiant Eclipse reentry while retaining the original stage owner.
 * Input: The original held swallow/day-speech requests and a second call on the same PhaseManager.
 * Output and oracle: Explicit phase, lifetime and rejection checks retain the first cycle's ownership; the second invocation never becomes a new owner.
 */
import { expect, test } from "bun:test";
import { radiantFixture } from "../../../support/features/radiant-eclipse/builders/runtime-game";
import { radiantProvider } from "../../../support/features/radiant-eclipse/drivers/actions";
import { Phase } from "../../../../src/core";
for (const moment of ["swallow", "day_speech"] as const)
  test(`same PM rejected reentry preserves original ${moment} owner and phase`, async () => {
    const f = await radiantFixture();
    await f.phaseManager.runSingleCycle(radiantProvider(f.requests), 20);
    expect(f.phaseManager.getSnapshot()).toMatchObject({
      day: 2,
      phase: Phase.Voting,
      gameOver: false,
    });
    let seen = false;
    await f.phaseManager.runSingleCycle(
      radiantProvider(f.requests, { swallow: 5, dream: 7 }, async (r) => {
        const chosen =
          moment === "swallow"
            ? r.context.stage === "eclipse_swallow"
            : r.phase === Phase.Day && r.allowedTools.includes("speak");
        if (!seen && chosen) {
          seen = true;
          const before = f.phaseManager.getSnapshot(),
            eventCount = f.phaseManager.getEvents().length;
          await expect(f.phaseManager.runSingleCycle(radiantProvider([]), 20)).rejects.toThrow(
            "radiant_night_reentry",
          );
          expect(f.phaseManager.getSnapshot()).toEqual(before);
          expect(f.phaseManager.getEvents()).toHaveLength(eventCount);
        }
        return undefined;
      }),
      20,
    );
    expect(seen).toBe(true);
    expect(f.phaseManager.getSnapshot()).toMatchObject({
      day: 3,
      phase: Phase.Voting,
      gameOver: false,
    });
  });
