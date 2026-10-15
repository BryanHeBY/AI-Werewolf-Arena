/**
 * Unit tests check Noble's concrete opening and sender-to-manager night ownership.
 * Fixed authority players and throwing runtime ports supply the inputs; literal
 * getter order, original errors, retained notices and authority terminal states
 * supply independent expectations. One bounded night uses no transport or model.
 * Normal manager close must retain the original later abort until body resolution.
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { nobleBodyAuthorityFixture } from "../../../support/features/noble-secret-body/drivers/authority";
import { NobleNightUnit } from "../../../../src/features/noble-secret-body/ports";
import {
  checkpointNobleBodyAuthority,
  openSecretBodyChoice,
  expireServantAtNightEnd,
  resolveSecretBodyDamage,
} from "../../../../src/features/noble-secret-body/authority";

function fixture(failure?: "events" | "record") {
  const base = nobleBodyAuthorityFixture(),
    events: GameEvent[] = [],
    trace: string[] = [],
    error = new Error(`noble_${failure}_rejected`);
  const unit = new NobleNightUnit(
    {
      get world() {
        trace.push("world");
        return base.world;
      },
      get events() {
        trace.push("events");
        if (failure === "events") throw error;
        return events;
      },
      recordOpening(payload) {
        trace.push("record");
        expect(payload).toEqual({
          policy: "awa_noble_secret_body_v1",
          actorId: 1,
          day: 1,
          notifiedActorIds: [1, 2],
        });
        if (failure === "record") throw error;
      },
    },
    1,
  );
  return { ...base, unit, trace, events, error };
}

test("inert construction preserves opening read order and transfers the actual receiver", () => {
  const f = fixture();
  expect(f.trace).toEqual([]);
  f.unit.open(() => {
    f.trace.push("current");
    return true;
  });
  expect(f.trace).toEqual(["world", "current", "events", "world", "events", "record"]);
  expect(f.events.map((event) => event.type)).toEqual([
    "noble_night_notified",
    "secret_body_night_notified",
    "noble_body_night_opened",
  ]);
  const receiver = f.unit.receiver;
  f.unit.transferToManager();
  f.unit.abortIfOwned();
  expect(f.unit.receiver).toBe(receiver);
  expect(f.trace.at(-1)).toBe("record");
  expect(checkpointNobleBodyAuthority(f.world, true).nights[0]?.status).toBe("open");
  expect(() => f.unit.open(() => true)).toThrow("noble_night_pipeline_ownership_transferred");
  receiver.abort(f.world, 1);
  expect(checkpointNobleBodyAuthority(f.world, false).nights[0]?.status).toBe("aborted");
});

for (const failure of ["events", "record"] as const)
  test(`opening ${failure} failure retains the acquired and published prefix`, () => {
    const f = fixture(failure);
    expect(() => f.unit.open(() => true)).toThrow(f.error);
    f.unit.abortIfOwned();
    expect(f.trace).toEqual(
      failure === "events"
        ? ["world", "events", "world"]
        : ["world", "events", "world", "events", "record", "world"],
    );
    expect(f.events).toHaveLength(failure === "events" ? 0 : 3);
    const state = checkpointNobleBodyAuthority(f.world, false);
    expect(state.nights[0]?.status).toBe("aborted");
    expect(state.notices).toHaveLength(2);
    expect(state.body.body.kind).toBe("intact");
  });

test("failed begin does not acquire an additional sender cleanup read", () => {
  const f = fixture(),
    error = new Error("noble_current_rejected");
  expect(() =>
    f.unit.open(() => {
      throw error;
    }),
  ).toThrow(error);
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world"]);
  expect(f.events).toEqual([]);
});

for (const resolved of [false, true])
  test(`manager normal close retains authority-controlled abort; bodyResolved=${resolved}`, () => {
    const f = fixture();
    f.unit.open(() => true);
    openSecretBodyChoice(f.world, 1).commit(null);
    expireServantAtNightEnd(f.world, 1);
    f.unit.transferToManager();
    f.unit.receiver.closeNormally(f.world, 1);
    if (resolved) resolveSecretBodyDamage(f.world, 1, {});
    f.unit.receiver.abort(f.world, 1);
    expect(checkpointNobleBodyAuthority(f.world, false).nights[0]).toMatchObject({
      status: resolved ? "normal" : "aborted",
      bodyResolved: resolved,
      expiryProcessed: true,
    });
    f.unit.abortIfOwned();
    expect(f.trace.at(-1)).toBe("record");
  });
