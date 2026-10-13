/**
 * Failure scenarios verify Fragrant Pair Seer checkpoint state agrees with canonical God facts after controlled stock corruption.
 * Input: The original runtime game, pair/phantom forgeries or a hostile getter and an injected phase failure.
 * Output and oracle: Literal canonical stock, getter-call counts and original error identity are asserted after the real failed cycle; no expected archive is regenerated.
 */
import { test, expect } from "bun:test";
import { fragrantRuntimeGame as game } from "../../../support/features/fragrant-pair-seer/builders/runtime-game";
import { fragrantRuntimeAction as act } from "../../../support/features/fragrant-pair-seer/drivers/actions";
import { captureCheckpoint } from "../../../../src/runtime/simulation/reproduction_context";
import { COMPONENT } from "../../../../src/core/domain/components/names";
for (const alteration of ["pair_forgery", "pair_getter", "phantom_forgery"] as const)
  test(`failure CP canonical God state and original player stock agree after ${alteration}`, async () => {
    const g = game(),
      error = Error(`unique_CP_${alteration}`);
    let caught: unknown,
      gets = 0;
    try {
      await g.phaseManager.runSingleCycle(
        {
          async getAction(r) {
            if (r.context.stage === "pair_inspection") {
              const role = g.world.getComponent<any>(
                alteration === "phantom_forgery" ? 1 : 9,
                COMPONENT.Role,
              )!;
              if (alteration === "phantom_forgery") role.privateState.fragrant.knownWolfId = 2;
              else if (alteration === "pair_forgery")
                role.privateState.pairSeer.history = [
                  { day: 1, targetIds: [1, 9], containsWerewolf: false },
                ];
              else
                Object.defineProperty(role.privateState.pairSeer, "history", {
                  enumerable: true,
                  configurable: true,
                  get() {
                    gets++;
                    return [{ day: 1, targetIds: [1, 9], containsWerewolf: false }];
                  },
                });
              throw error;
            }
            return act(r, { bind: [5, 6] });
          },
        },
        8,
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBe(error);
    const cp = captureCheckpoint(
      g.world,
      g.phaseManager.getSnapshot(),
      1,
      false,
      g.phaseManager.getEvents().length,
      error,
    );
    expect(gets).toBe(0);
    const phantom = cp.players.find((p) => p.id === 1)!,
      seer = cp.players.find((p) => p.id === 9)!;
    expect(phantom.privateState.fragrant).toEqual(cp.fragrantPair!.fragrant);
    expect(seer.privateState.pairSeer).toEqual(cp.fragrantPair!.pairSeer);
    expect((seer.privateState.abilities as any)["native:pair_check"].state).toEqual(
      cp.fragrantPair!.pairSeer,
    );
  });
