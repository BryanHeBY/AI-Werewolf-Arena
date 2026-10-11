import { expect, test } from "bun:test";
import { radiantRecording } from "../support/radiant_eclipse_recording";
for (const stage of ["sheriff_nomination", "day_speech", "voting"] as const)
  test(`real automatic recording flush during pending ${stage}`, async () => {
    let delayed = false;
    const r = await radiantRecording({
      provider: (_game, manual) => ({
        getAction: async (q) => {
          if (!delayed && q.context.day === 1 && q.context.stage === stage) {
            delayed = true;
            await Bun.sleep(1100);
          }
          return manual.getAction(q);
        },
      }),
    });
    expect(delayed).toBe(true);
    expect(r.finalized).toBe(true);
    expect(r.termination?.errors).toEqual([]);
  }, 10000);
