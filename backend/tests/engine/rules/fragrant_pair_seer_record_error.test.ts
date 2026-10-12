import { expect, test } from "bun:test";
import {
  fragrantRuntimeGame as game,
  fragrantRuntimeAction as act,
  type FragrantRuntimePlan,
} from "../../support/fragrant_pair_seer_scenarios";
import {
  fragrantAuthoritySnapshot,
  prepareFragrantDeathWave,
} from "../../../src/game/mechanisms/roles/fragrant_pair_seer/authority";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import type { SessionRecordManager } from "../../../src/recording/session_recorder";
import { COMPONENT } from "../../../src/core/domain/components/names";
import type { AliveComponent } from "../../../src/core/domain/components/alive";
for (const path of ["initial", "gun"] as const)
  test(`${path} wave record failure preserves the paid real deaths and original error`, async () => {
    const g = game(),
      failure = Error(`unique_required_${path}_record_error`);
    let injections = 0,
      caught: unknown;
    const recorder: Pick<SessionRecordManager, "recordLogicOp" | "recordRequiredLogicOp"> = {
        recordLogicOp() {},
        recordRequiredLogicOp(op) {
          if (op.op === "fragrant_link_triggered") {
            injections++;
            throw failure;
          }
        },
      },
      plan: FragrantRuntimePlan =
        path === "initial"
          ? { bind: [5, 6], knife: 5 }
          : { bind: [5, 6], knife: 11, poison: 1, shoot: 5 };
    try {
      await runWithSessionRecorder(recorder as SessionRecordManager, () =>
        g.phaseManager.runSingleCycle(
          {
            async getAction(r) {
              return act(r, plan);
            },
          },
          8,
        ),
      );
    } catch (error) {
      caught = error;
    }
    expect(injections).toBe(1);
    expect(caught).toBe(failure);
    expect(
      g.world
        .entityIds()
        .filter((id) => !g.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive),
    ).toEqual(path === "initial" ? [5, 6] : [1, 5, 6, 11]);
    const owned = fragrantAuthoritySnapshot(g.world);
    expect(owned.fragrant.trigger).toEqual({
      bindingId: "fragrant:night:1",
      day: 1,
      rootId: 5,
      addedTargetId: 6,
    });
    expect(owned.fragrant.bindings[0]!.status).toEqual({ kind: "triggered", day: 1 });
    expect(prepareFragrantDeathWave(g.world, 1, [])).toBeNull();
    const events = g.phaseManager.getEvents(),
      facts = events.filter((e) => e.type === "fragrant_link_triggered");
    expect(facts).toHaveLength(1);
    expect(facts[0]!.audience).toEqual([]);
    expect(events.filter((e) => e.type === "additional_deaths")).toHaveLength(0);
    expect(events.filter((e) => e.type === "game_over")).toHaveLength(0);
  });
