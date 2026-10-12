/**
 * Archive verifier unit tests verify Red Moon serialized blast, sealed decisions and delayed expiry.
 * Input: Handwritten causal record fragments and independently mutated event/checkpoint sequences.
 * Output and independent oracle: Literal accepted/rejected adjacency, source/day and ordinary-settlement conditions; no engine game is executed.
 * This boundary never substitutes an unrelated full game or production reducer for its explicit oracle.
 */
import { validateDemonHunterRecord } from "../../../src/recording/demon_hunter_record";
import { expect, test } from "bun:test";
import { redMoonCandidateWorld } from "../../support/features/red-moon/builders/candidate-world";
import { COMPONENT, type RoleComponent } from "../../../src/core";
import type { ReproductionRecord } from "../../../src/recording/reproduction";
import { validateRedMoonRecord } from "../../../src/recording/red_moon_record";
function fixture(policy: "ends_game" | "forbidden" = "ends_game"): any {
  const { world, config } = redMoonCandidateWorld(policy);
  return {
    finalized: true,
    metadata: {
      normalizedBoard: config,
      players: world.entityIds().map((id) => {
        const role = world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
        return { id, role: role.role, camp: role.camp };
      }),
    },
    events: [],
    operations: [],
    decisions: [],
    checkpoints: [{ complete: true, players: [], eventCount: 0 }],
  };
}
function event(r: any, type: string, payload: any) {
  r.events.push({ type, payload });
}
function phase(r: any, day: number, value: string) {
  event(r, "phase_changed", { day, phase: value });
}
function frozen(r: any, day: number, deaths: number[]) {
  r.operations.push({ op: "demon_hunter_sources_frozen", output: { day, deaths } });
}
function deferred() {
  const r = fixture();
  phase(r, 1, "night");
  frozen(r, 1, [1, 2, 3]);
  event(r, "night_resolved", { deaths: [1, 2, 3] });
  phase(r, 1, "voting");
  event(r, "vote_summary", { target: 4 });
  event(r, "red_moon_exile_delayed", { actorId: 4, day: 1, night: 2 });
  phase(r, 2, "night");
  return r;
}
function expiry(r: any) {
  event(r, "red_moon_delay_expired", { actorId: 4, day: 2 });
  r.operations.push({
    op: "red_moon_expiry_settled",
    scope: "resolution",
    phase: "night",
    status: "ok",
    output: { actorId: 4, day: 2, cause: "red_moon_expiry" },
  });
}
test("Red Moon serialized blast requires the adjacent real blast and records only its following night", () => {
  const r = fixture();
  phase(r, 1, "day");
  event(r, "wolf_self_destruct", { wolfId: 4 });
  event(r, "red_moon_night_sealed", { actorId: 4, day: 1, night: 2 });
  const audit = validateRedMoonRecord(r as ReproductionRecord)!;
  expect([...audit.sealedNights]).toEqual([2]);
  expect(audit.stateAt(r.events.length).blastDay).toBe(1);
  r.events.splice(1, 1);
  expect(() => validateRedMoonRecord(r)).toThrow();
});
test("A sealed night cannot contain a good native decision", () => {
  const r = fixture();
  phase(r, 1, "day");
  event(r, "wolf_self_destruct", { wolfId: 4 });
  event(r, "red_moon_night_sealed", { actorId: 4, day: 1, night: 2 });
  r.decisions.push({ day: 2, stage: "seer", request: { context: { visible_events: [] } } });
  expect(() => validateRedMoonRecord(r)).toThrow();
});
test("Serialized deferred expiry requires ordinary settlement, remaining good sides and the exact late source", () => {
  const r = deferred();
  frozen(r, 2, [5]);
  expiry(r);
  event(r, "night_resolved", { deaths: [5, 4] });
  const audit = validateRedMoonRecord(r)!;
  expect(audit.expiredNights.get(2)).toBe(4);
  expect(audit.stateAt(r.events.length).expirySettled).toBe(true);
  r.operations.at(-1).output.actorId = 5;
  expect(() => validateRedMoonRecord(r)).toThrow();
});
test("An ordinary last knife ending the game skips expiry", () => {
  const r = deferred();
  frozen(r, 2, [5, 6, 7, 8]);
  event(r, "night_resolved", { deaths: [5, 6, 7, 8] });
  expect(validateRedMoonRecord(r)!.expiredNights.size).toBe(0);
  r.events.pop();
  expiry(r);
  event(r, "night_resolved", { deaths: [5, 6, 7, 8, 4] });
  expect(() => validateRedMoonRecord(r)).toThrow();
});
test("Missing expiry and duplicate death are rejected in completed night facts", () => {
  const r = deferred();
  frozen(r, 2, [5]);
  event(r, "night_resolved", { deaths: [5] });
  expect(() => validateRedMoonRecord(r)).toThrow();
  r.events.pop();
  expiry(r);
  event(r, "night_resolved", { deaths: [5, 4, 4] });
  expect(() => validateRedMoonRecord(r)).toThrow();
});
test("Ordinary damage already killing Red Moon does not require another expiry", () => {
  const r = deferred();
  frozen(r, 2, [4]);
  event(r, "night_resolved", { deaths: [4] });
  expect(validateRedMoonRecord(r)!.expiredNights.size).toBe(0);
});
test("An unauthenticated exile and a forbidden final wolf blast fail serialized audit", () => {
  const r = fixture();
  phase(r, 1, "voting");
  event(r, "vote_summary", { target: 4 });
  event(r, "red_moon_exile_delayed", { actorId: 4, day: 1, night: 2 });
  expect(() => validateRedMoonRecord(r)).toThrow();
  const last = fixture("forbidden");
  phase(last, 1, "night");
  frozen(last, 1, [1, 2, 3]);
  event(last, "night_resolved", { deaths: [1, 2, 3] });
  phase(last, 1, "day");
  event(last, "wolf_self_destruct", { wolfId: 4 });
  expect(() => validateRedMoonRecord(last)).toThrow();
});
test("Idiot reveal must match the actual living exile target and occur once", () => {
  const r = fixture();
  phase(r, 1, "voting");
  event(r, "vote_summary", { target: 12 });
  event(r, "idiot_revealed", { targetId: 12 });
  expect(validateRedMoonRecord(r)!.idiotRevealedAt(r.events.length)).toBe(true);
  event(r, "idiot_revealed", { targetId: 12 });
  expect(() => validateRedMoonRecord(r)).toThrow();
});

test("Incremental Demon record still enforces original checkpoint identity", () => {
  const r = fixture();
  r.finalized = false;
  const { world } = redMoonCandidateWorld();
  r.checkpoints = [
    {
      cycle: 0,
      complete: true,
      eventCount: 0,
      players: world.entityIds().map((id) => {
        const role = world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
        return {
          id,
          role: role.role,
          camp: role.camp,
          alive: true,
          victory: { affiliations: [{ kind: "faction", faction: role.camp }] },
          privateState: structuredClone(role.privateState),
        };
      }),
    },
  ];
  expect(() => validateDemonHunterRecord(r)).not.toThrow();
  r.checkpoints[0].players[0].role = "nightmare";
  expect(() => validateDemonHunterRecord(r)).toThrow("reproduction_demon_hunter_state_invalid");
});
test("A failed record cannot drop the seal then advance into another phase", () => {
  const r = fixture();
  r.checkpoints[0].complete = false;
  phase(r, 1, "day");
  event(r, "wolf_self_destruct", { wolfId: 4 });
  phase(r, 2, "night");
  expect(() => validateRedMoonRecord(r)).toThrow("reproduction_red_moon_state_invalid");
});
