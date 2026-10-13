/**
 * Unit test checks committed badge transfer/destruction in the original Demon checkpoint metadata owner. Inputs are an in-memory roster, trusted badge commands and a fake badge refund; literal original checkpoint fields and revocation errors are the oracle. No complete phase, persistence, network or model runs.
 */
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../src/core";
import { demonHunterFixture } from "../../support/features/demon-hunter/builders/candidate-world";
import { captureCheckpoint } from "../../../src/runtime/simulation/reproduction_context";

test("actual badge transfer and destruction survive subsequent failure; mutable fake badge stays out", async () => {
  const { assignSheriff, commitSheriffBadgeChoice } =
    await import("../../../src/game/mechanisms/sheriff/badge");
  const f = demonHunterFixture(12),
    events: import("../../../src/core").GameEvent[] = [];
  expect(assignSheriff(f.world, 4, f.config)).toBe(true);
  commitSheriffBadgeChoice(f.world, 4, "actual", events, 5);
  let cp = captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 0, false, events.length);
  expect(cp.players[3]).toMatchObject({
    badge: { isSheriff: false, destroyed: true },
    vote: { weight: 1 },
  });
  expect(cp.players[4]).toMatchObject({
    badge: { isSheriff: true, destroyed: false },
    vote: { weight: 1.5 },
  });
  commitSheriffBadgeChoice(f.world, 5, "actual", events, null);
  cp = captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 0, false, events.length);
  expect(cp.players[4]).toMatchObject({
    badge: { isSheriff: false, destroyed: true },
    vote: { weight: 1 },
  });
  const badge = f.world.getComponent<import("../../../src/core").BadgeComponent>(
    5,
    COMPONENT.Badge,
  )!;
  badge.isSheriff = true;
  expect(() =>
    captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 0, true, events.length),
  ).toThrow("metadata_revoked");
  expect(() => assignSheriff(f.world, 6, f.config)).toThrow("badge_stock_revoked");
  expect(
    captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 0, false, events.length).players[4]!
      .badge,
  ).toEqual(cp.players[4]!.badge);
});
