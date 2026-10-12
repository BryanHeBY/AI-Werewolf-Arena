import { expect, test } from "bun:test";
import {
  fragrantRuntimeGame as game,
  fragrantRuntimeAction as act,
} from "../../support/fragrant_pair_seer_scenarios";
import { fragrantPairOwnerFixture } from "../fragrant_pair_seer_fixture";
import {
  closeFragrantNight,
  prepareFragrantDeathWave,
  cancelFragrantDeathWave,
  fragrantAuthoritySnapshot,
} from "../../../src/game/mechanisms/roles/fragrant_pair_seer/authority";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { Phase } from "../../../src/core/domain/identity";
import { DeathCause } from "../../../src/core/domain/deaths";
import { COMPONENT } from "../../../src/core/domain/components/names";
import {
  createAliveComponent,
  type AliveComponent,
} from "../../../src/core/domain/components/alive";
import type { RuntimeSnapshot } from "../../../src/core/domain/model";
test("day cycle reentry rejects before mutating the outer phase or feed", async () => {
  const g = game();
  let checked = false;
  await g.phaseManager.runSingleCycle(
    {
      async getAction(r) {
        if (!checked && r.context.stage === "sheriff_nomination") {
          checked = true;
          const before = g.phaseManager.getSnapshot(),
            events = g.phaseManager.getEvents();
          await expect(
            g.phaseManager.runSingleCycle(
              {
                async getAction() {
                  throw Error("nested_provider_must_not_run");
                },
              },
              8,
            ),
          ).rejects.toThrow("fragrant_cycle_reentry");
          expect(g.phaseManager.getSnapshot()).toEqual(before);
          expect(g.phaseManager.getEvents()).toEqual(events);
        }
        return act(r, { bind: [5, 6] });
      },
    },
    8,
  );
  expect(checked).toBe(true);
  expect(g.phaseManager.getSnapshot().day).toBe(2);
});
for (const mode of ["false", "throw"] as const)
  test(`uncommitted initial death reservation releases on ${mode} cancellation without spending`, async () => {
    const f = fragrantPairOwnerFixture();
    f.open();
    f.choices([9, 10]);
    closeFragrantNight(f.world, 1, "normal");
    const state: RuntimeSnapshot = { day: 1, phase: Phase.Day, gameOver: false, result: null },
      resolver = new DeathResolution(
        f.world,
        f.events,
        new ToolGateway(),
        new EventRegistry(),
        state,
      );
    let checks = 0,
      error: unknown;
    try {
      await resolver.resolve(
        [9],
        { 9: [DeathCause.WolfKill] },
        {
          async getAction() {
            throw Error("no_request_expected");
          },
        },
        Phase.Night,
        Phase.Day,
        {},
        {
          isCurrent: () => {
            if (++checks < 2) return true;
            if (mode === "throw") throw Error("cancel_at_wave");
            return false;
          },
        },
      );
    } catch (value) {
      error = value;
    }
    if (mode === "throw") expect(String(error)).toContain("cancel_at_wave");
    else expect(error).toBeUndefined();
    expect(f.world.getComponent<AliveComponent>(9, COMPONENT.Alive)!.alive).toBe(true);
    expect(f.world.getComponent<AliveComponent>(10, COMPONENT.Alive)!.alive).toBe(true);
    expect(fragrantAuthoritySnapshot(f.world).fragrant.trigger).toBeNull();
    const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
    expect(receipt).not.toBeNull();
    cancelFragrantDeathWave(f.world, receipt);
  });
for (const replace of [false, true])
  test(`aborted night retains original provider failure even after actor replacement=${replace}`, async () => {
    const g = game(),
      original = g.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!,
      failure = Error("provider_unique_failure");
    let thrown: unknown;
    try {
      await g.phaseManager.runSingleCycle(
        {
          async getAction(r) {
            if (r.context.stage === "fragrant_bind") {
              if (replace) g.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
              throw failure;
            }
            return act(r);
          },
        },
        8,
      );
    } catch (error) {
      thrown = error;
    }
    // Restore solely to inspect the held failed owner, never to resume this game.
    if (replace) g.world.addComponent(1, COMPONENT.Alive, original);
    expect(thrown).toBe(failure);
    expect(fragrantAuthoritySnapshot(g.world).nights[0]!.status).toBe("aborted");
    expect(fragrantAuthoritySnapshot(g.world).fragrant.knowledgeNight).toBe(1);
  });
