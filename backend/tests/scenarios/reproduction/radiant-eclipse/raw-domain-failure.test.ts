/**
 * Reproduction scenarios verify real Radiant Eclipse same-tool missing-target failures finalize and replay their raw failed prefix.
 * Input: Original swallow/shelter requests, empty action arguments and the existing controlled recording driver.
 * Output and oracle: Literal action-reached, finalization and replay assertions retain the original failed outcome; invalid action arguments are not repaired by the test.
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
for (const stage of ["eclipse_swallow", "radiant_shelter"] as const)
  test(`a real ${stage} same-tool missing-target failure can finalize and replay its raw failed prefix`, async () => {
    let actionReached = false;
    const result = await radiantRecording({
      failureStage: stage,
      provider: (_game, manual) => ({
        getAction: async (request) => {
          if (request.context.day === 2 && request.context.stage === stage) {
            actionReached = true;
            return {
              name: stage === "eclipse_swallow" ? "swallow_skill" : "cast_shelter",
              args: {},
            } as any;
          }
          return manual.getAction(request);
        },
      }),
    });
    expect(actionReached).toBe(true);
    expect(result.finalized).toBe(true);
    expect(result.termination?.reason).toBe("runtime_error");
    expect(result.checkpoints.at(-1)?.complete).toBe(false);
    const row = result.decisions.find((d) => d.day === 2 && d.stage === stage)!;
    expect(row.outcome.kind).toBe("action");
    expect(
      row.outcome.kind === "action" ? (row.outcome.action?.args as unknown) : undefined,
    ).toEqual({});
  });
