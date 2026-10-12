/**
 * Unit tests for animal-dream; Isolated animal-dream request-envelope contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { animalRosterFixture } from "../../../engine/animal_dream_fixture";
import { bindCharm, activeCharm } from "../../../../src/game/mechanisms/roles/wolf_beauty/relation";
import { getWolfBeautyState } from "../../../../src/game/mechanisms/roles/private_state";
import {
  captureAnimalRequestEnvelope,
  animalRequestEnvelopeCurrent,
  animalRequestEnvelopeHeader,
  inheritAnimalRequestEnvelope,
  revokeAnimalRequestEnvelope,
} from "../../../../src/game/mechanisms/roles/animal_dream/request_envelope";
import {
  installAnimalAuthority,
  beginAnimalNight,
  closeAnimalNight,
  createAnimalFoxRequest,
  openAnimalFoxChoice,
  beginAnimalExileUnit,
  recordAnimalBallotRound,
  sealAnimalBallots,
  createAnimalPufferRequest,
  openAnimalPufferChoice,
  animalAuthoritySnapshot,
} from "../../../../src/game/mechanisms/roles/animal_dream/authority";
const fixture = () => animalRosterFixture(undefined, installAnimalAuthority);
function request(kind: "fox" | "puffer" = "fox", day = 2) {
  const name = kind === "fox" ? "fox_distract" : "puffer_retaliate";
  return {
    phase: kind === "fox" ? "night" : "voting",
    actorId: kind === "fox" ? 10 : 12,
    allowedTools: [name],
    context: {
      day,
      stage: kind === "fox" ? "fox_distract" : "puffer_reaction",
      visible_events: [],
      allow_fallback: false,
      action_failure_policy: "error",
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1, required_any_tools: [name] },
      ...(kind === "fox" ? { fox_candidates: Array.from({ length: 12 }, (_, i) => i + 1) } : {}),
    },
  };
}
function second(f: ReturnType<typeof fixture>, current = () => true) {
  beginAnimalNight(f.world, 1, () => true);
  closeAnimalNight(f.world, 1, "normal");
  beginAnimalNight(f.world, 2, current);
}
test("signed immutable metadata preserves exact request body and rejects fabricated capabilities", () => {
  const f = fixture(),
    raw = request(),
    envelope = captureAnimalRequestEnvelope(f.world, raw);
  expect(animalRequestEnvelopeHeader(envelope)).toEqual({
    kind: "fox",
    actorId: 10,
    day: 2,
    candidates: Array.from({ length: 12 }, (_, i) => i + 1),
  });
  expect(animalRequestEnvelopeCurrent(envelope)).toBe(true);
  expect(animalRequestEnvelopeCurrent({})).toBe(false);
  expect(Object.isFrozen(animalRequestEnvelopeHeader(envelope))).toBe(true);
});
test("only identical original context and bounded deadline clones join one immutable request", () => {
  const f = fixture(),
    raw = request(),
    envelope = captureAnimalRequestEnvelope(f.world, raw),
    deadline = Date.now() + 10000,
    clone = { ...raw, deadlineAtMs: deadline };
  inheritAnimalRequestEnvelope(envelope, raw, clone);
  expect(animalRequestEnvelopeCurrent(envelope)).toBe(true);
  expect(() =>
    inheritAnimalRequestEnvelope(envelope, clone, { ...clone, deadlineAtMs: deadline + 1 }),
  ).toThrow();
  expect(() =>
    inheritAnimalRequestEnvelope(envelope, raw, {
      ...raw,
      context: { ...raw.context },
      deadlineAtMs: deadline - 1,
    }),
  ).toThrow();
  const earlier = { ...clone, deadlineAtMs: deadline - 10 };
  inheritAnimalRequestEnvelope(envelope, clone, earlier);
  expect(animalRequestEnvelopeCurrent(envelope)).toBe(true);
});
test("mutating or restoring a request body cannot recover a withdrawn envelope", () => {
  const f = fixture(),
    raw = request(),
    envelope = captureAnimalRequestEnvelope(f.world, raw);
  raw.context.day = 3;
  expect(animalRequestEnvelopeCurrent(envelope)).toBe(false);
  raw.context.day = 2;
  expect(animalRequestEnvelopeCurrent(envelope)).toBe(false);
});
test("original and alias deadline/body mutations revoke the whole envelope", () => {
  const f = fixture(),
    raw = request(),
    envelope = captureAnimalRequestEnvelope(f.world, raw),
    clone = { ...raw, deadlineAtMs: Date.now() + 10000 };
  inheritAnimalRequestEnvelope(envelope, raw, clone);
  clone.deadlineAtMs += 1;
  expect(animalRequestEnvelopeCurrent(envelope)).toBe(false);
  revokeAnimalRequestEnvelope(envelope);
  expect(animalRequestEnvelopeCurrent(envelope)).toBe(false);
});
test("context and deadline getters execute zero code, including at final read", () => {
  const f = fixture(),
    raw = request(),
    envelope = captureAnimalRequestEnvelope(f.world, raw);
  let reads = 0;
  Object.defineProperty(raw, "context", {
    enumerable: true,
    get() {
      reads++;
      return {};
    },
  });
  expect(animalRequestEnvelopeCurrent(envelope)).toBe(false);
  expect(reads).toBe(0);
  const invalid = Object.defineProperty(request(), "deadlineAtMs", {
    enumerable: true,
    get() {
      reads++;
      return Date.now() + 10000;
    },
  });
  expect(() => captureAnimalRequestEnvelope(f.world, invalid)).toThrow();
  expect(reads).toBe(0);
});
for (const field of [
  "actor",
  "phase",
  "tool",
  "stage",
  "fallback",
  "required",
  "candidates",
] as const)
  test(`${field}: invalid fixed mechanism request cannot be signed`, () => {
    const f = fixture(),
      raw = request();
    if (field === "actor") raw.actorId = 13;
    if (field === "phase") raw.phase = "voting";
    if (field === "tool") raw.allowedTools = ["speak"];
    if (field === "stage") raw.context.stage = "wrong";
    if (field === "fallback") raw.context.allow_fallback = true;
    if (field === "required") raw.context.turn_constraints.min_valid_actions = 0;
    if (field === "candidates") raw.context.fox_candidates = [10, 10];
    expect(() => captureAnimalRequestEnvelope(f.world, raw)).toThrow(
      "animal_request_envelope_invalid",
    );
  });
test("same headers do not bind a foreign World or a different Fox actor's request", () => {
  const f = fixture(),
    other = fixture();
  second(f);
  second(other);
  const raw = request(),
    foreign = captureAnimalRequestEnvelope(other.world, raw);
  expect(() => createAnimalFoxRequest(f.world, 2, undefined, foreign)).toThrow();
  raw.actorId = 9;
  const wrong = captureAnimalRequestEnvelope(f.world, raw);
  expect(() => createAnimalFoxRequest(f.world, 2, undefined, wrong)).toThrow();
  expect(animalAuthoritySnapshot(f.world)!.fox.history).toEqual([]);
});
for (const field of ["context", "allowed-tools", "candidate", "deadline-getter"] as const)
  test(`last phase callback changing ${field} cannot pay a signed Fox request`, () => {
    const f = fixture(),
      raw = request();
    let calls = 0,
      armed = false,
      reads = 0;
    second(f, () => {
      if (armed && ++calls === 2) {
        if (field === "context") raw.context = { ...raw.context };
        if (field === "allowed-tools") raw.allowedTools = ["speak"];
        if (field === "candidate") raw.context.fox_candidates = [10];
        if (field === "deadline-getter")
          Object.defineProperty(raw, "deadlineAtMs", {
            enumerable: true,
            get() {
              reads++;
              return undefined;
            },
          });
      }
      return true;
    });
    const envelope = captureAnimalRequestEnvelope(f.world, raw),
      permit = createAnimalFoxRequest(f.world, 2, undefined, envelope),
      choice = openAnimalFoxChoice(f.world, 2, permit.token);
    armed = true;
    expect(() => choice.commit(2)).toThrow();
    expect(reads).toBe(0);
    expect(animalAuthoritySnapshot(f.world, false)!.fox.history).toEqual([]);
  });
test("a deadline clone in the envelope cannot reset a Fox alias's earlier budget", async () => {
  const f = fixture();
  second(f);
  const raw = request(),
    envelope = captureAnimalRequestEnvelope(f.world, raw),
    clone = { ...raw, deadlineAtMs: Date.now() + 30 };
  inheritAnimalRequestEnvelope(envelope, raw, clone);
  const choice = openAnimalFoxChoice(
    f.world,
    2,
    createAnimalFoxRequest(f.world, 2, undefined, envelope).token,
  );
  await Bun.sleep(45);
  expect(() => choice.commit(2)).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.fox.usedNight).toBeNull();
});
test("Puffer final guard reads the same envelope after all controller code without a payment", () => {
  const f = fixture();
  beginAnimalNight(f.world, 1, () => true);
  closeAnimalNight(f.world, 1, "normal");
  const raw = request("puffer", 1);
  let armed = false,
    calls = 0;
  const unit = beginAnimalExileUnit(f.world, 1, "exile", () => {
    if (armed && ++calls === 2) raw.context.day = 2;
    return true;
  });
  recordAnimalBallotRound(
    f.world,
    unit,
    1,
    f.world.entityIds().map((actorId) => ({
      actorId,
      targetId: actorId === 2 ? 12 : null,
      abstain: actorId !== 2,
      weight: actorId === 2 ? 1 : 0,
    })),
  );
  sealAnimalBallots(f.world, unit);
  const envelope = captureAnimalRequestEnvelope(f.world, raw),
    choice = openAnimalPufferChoice(
      f.world,
      unit,
      createAnimalPufferRequest(f.world, unit, undefined, envelope).token,
    );
  armed = true;
  expect(() => choice.commit(true)).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.puffer.history).toEqual([]);
});
test("revoked Fox envelope preserves the real old Beauty relation and does not half-pay", () => {
  const f = fixture(),
    state = getWolfBeautyState(f.role(1))!;
  beginAnimalNight(f.world, 1, () => true);
  state.targetId = 5;
  state.lastActedDay = 1;
  state.history.push({ day: 1, targetId: 5 });
  bindCharm(f.world, 1, 5);
  closeAnimalNight(f.world, 1, "normal");
  const raw = { ...request(), deadlineAtMs: Date.now() + 10000 };
  let armed = false,
    calls = 0;
  beginAnimalNight(f.world, 2, () => {
    if (armed && ++calls === 2) raw.deadlineAtMs = Date.now() - 1;
    return true;
  });
  const binding = activeCharm(f.world, 1),
    envelope = captureAnimalRequestEnvelope(f.world, raw),
    choice = openAnimalFoxChoice(
      f.world,
      2,
      createAnimalFoxRequest(f.world, 2, undefined, envelope).token,
    );
  armed = true;
  expect(() => choice.commit(1)).toThrow();
  expect(state.targetId).toBe(5);
  expect(activeCharm(f.world, 1)).toBe(binding);
  expect(animalAuthoritySnapshot(f.world, false)!.fox.history).toEqual([]);
});
