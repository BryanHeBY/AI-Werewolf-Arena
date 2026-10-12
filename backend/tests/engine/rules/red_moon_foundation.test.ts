/**
 * Integration/scenario tests for red moon foundation configuration and setup contracts.
 * Input: the existing literal boards, original scenario actions and malformed
 * candidates. Output: the unchanged acceptance, roundtrip and state assertions.
 * Fixed policies, recorded literal expectations and rejection cases are the
 * oracle; these tests never generate replacement goldens from migrated rules.
 */
import { describe, expect, test } from "bun:test";
import { Camp } from "../../../src/core/domain/identity";
import type { RoleComponent } from "../../../src/core/domain/components/role";
import {
  freshRedMoonState,
  getRedMoonState,
  RED_MOON_ROLE,
} from "../../../src/game/mechanisms/roles/red_moon_apostle/state";
import {
  readRedMoonNextNightFact,
  readRedMoonExpiryFact,
  RED_MOON_BLAST_EVENT,
  RED_MOON_EXILE_EVENT,
  RED_MOON_EXPIRY_EVENT,
} from "@ai-werewolf-arena/game-text";
function role(state: unknown = freshRedMoonState()): RoleComponent {
  return {
    role: RED_MOON_ROLE,
    camp: Camp.Wolf,
    privateState: { redMoon: state },
  } as unknown as RoleComponent;
}
describe("Red Moon finite state", () => {
  test("defaults and both named last-wolf policies are readable", () => {
    for (const policy of ["ends_game", "forbidden"] as const) {
      const state = freshRedMoonState(policy);
      expect(getRedMoonState(role(state))).toBe(state);
    }
  });
  test("blast and exile states are separate, expiry requires exile", () => {
    for (const changes of [
      { blastDay: 2 },
      { exileDay: 2 },
      { exileDay: 2, expirySettled: true },
    ]) {
      const state = { ...freshRedMoonState(), ...changes };
      expect(getRedMoonState(role(state))).toBe(state);
    }
    expect(
      getRedMoonState(role({ ...freshRedMoonState(), blastDay: 2, exileDay: 2 })),
    ).toBeUndefined();
    expect(getRedMoonState(role({ ...freshRedMoonState(), expirySettled: true }))).toBeUndefined();
  });
  test("malformed states and wrong authority fail closed", () => {
    for (const field of [
      { policy: "other" },
      { lastWolfBlastPolicy: "other" },
      { blastDay: 0 },
      { blastDay: -1 },
      { blastDay: 1.5 },
      { blastDay: Number.MAX_SAFE_INTEGER },
      { exileDay: NaN },
      { expirySettled: 1 },
      { extra: true },
    ])
      expect(getRedMoonState(role({ ...freshRedMoonState(), ...field }))).toBeUndefined();
    expect(getRedMoonState({ ...role(), camp: Camp.Good } as RoleComponent)).toBeUndefined();
  });
  test("accessors and proxies are never evaluated", () => {
    let reads = 0;
    const state = freshRedMoonState();
    Object.defineProperty(state, "blastDay", {
      get() {
        reads++;
        throw new Error("getter");
      },
      enumerable: true,
    });
    expect(getRedMoonState(role(state))).toBeUndefined();
    expect(
      getRedMoonState(
        new Proxy(role(), {
          get() {
            reads++;
            throw new Error("proxy");
          },
        }),
      ),
    ).toBeUndefined();
    const revoked = Proxy.revocable(freshRedMoonState(), {});
    revoked.revoke();
    expect(getRedMoonState(role(revoked.proxy))).toBeUndefined();
    expect(reads).toBe(0);
  });
});
describe("Red Moon public facts", () => {
  test("next-night facts are detached and require exact adjacent days", () => {
    for (const type of [RED_MOON_BLAST_EVENT, RED_MOON_EXILE_EVENT]) {
      const fact = { actorId: 7, day: 2, night: 3 };
      const read = readRedMoonNextNightFact(type, fact);
      expect(read).toEqual(fact);
      expect(read).not.toBe(fact);
      for (const patch of [
        { night: 2 },
        { night: 4 },
        { day: 0 },
        { actorId: 0 },
        { secret: true },
      ]) {
        expect(readRedMoonNextNightFact(type, { ...fact, ...patch })).toBeNull();
      }
    }
  });
  test("expiry fact cannot carry extra private state or use other event types", () => {
    expect(readRedMoonExpiryFact(RED_MOON_EXPIRY_EVENT, { actorId: 7, day: 3 })).toEqual({
      actorId: 7,
      day: 3,
    });
    expect(
      readRedMoonExpiryFact(RED_MOON_EXPIRY_EVENT, { actorId: 7, day: 3, camp: "wolf" }),
    ).toBeNull();
    expect(readRedMoonExpiryFact(RED_MOON_BLAST_EVENT, { actorId: 7, day: 3 })).toBeNull();
    expect(
      readRedMoonNextNightFact(RED_MOON_EXPIRY_EVENT, { actorId: 7, day: 2, night: 3 }),
    ).toBeNull();
  });
});

test("Red Moon fact readers reject accessors without invoking getters", () => {
  let reads = 0;
  const next = { actorId: 7, day: 2, night: 3 };
  Object.defineProperty(next, "night", {
    enumerable: true,
    get() {
      reads++;
      throw new Error("getter");
    },
  });
  expect(readRedMoonNextNightFact(RED_MOON_BLAST_EVENT, next)).toBeNull();
  const expiry = { actorId: 7, day: 3 };
  Object.defineProperty(expiry, "day", {
    enumerable: true,
    get() {
      reads++;
      throw new Error("getter");
    },
  });
  expect(readRedMoonExpiryFact(RED_MOON_EXPIRY_EVENT, expiry)).toBeNull();
  expect(reads).toBe(0);
});

import { DEMON_HUNTER_POLICY } from "@ai-werewolf-arena/game-text";
import { isRedMoonPreset } from "../../../src/rulesets";
function redMoonConfig(lastWolfBlastPolicy: "ends_game" | "forbidden" = "ends_game") {
  return {
    boardSize: 12,
    enableSheriff: true,
    winCondition: "slaughter_side",
    redMoon: { policy: "awa_red_moon_demon_v1", lastWolfBlastPolicy },
    demonHunter: { policy: DEMON_HUNTER_POLICY },
    roleSetups: Object.entries({
      wolf: 3,
      red_moon_apostle: 1,
      villager: 4,
      seer: 1,
      witch: 1,
      demon_hunter: 1,
      idiot: 1,
    }).map(([role, count]) => ({ role, count })),
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    witch: {
      canSelfHeal: "disabled",
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    voting: { exilePolicy: "awa_direct_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
    sheriff: {
      electionPolicy: "awa_final_candidates_v1",
      badgePolicy: "awa_next_seat_v1",
      voteWeight: 1.5,
    },
    tieBreaker: { sheriffVote: "min_seat", wolfKillVote: "min_id", exileVote: "min_id" },
    hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: ["on_pre_election", "on_pre_vote"] },
  };
}
test("Red Moon preset accepts only the two named finite policies", () => {
  for (const policy of ["ends_game", "forbidden"] as const)
    expect(isRedMoonPreset(redMoonConfig(policy))).toBe(true);
});
test("Red Moon preset rejects role, policy, count and unknown-field mutations", () => {
  const valid = redMoonConfig();
  for (const c of [
    { ...valid, boardSize: 6 },
    { ...valid, enableSheriff: false },
    { ...valid, winCondition: "slaughter_city" },
    { ...valid, winConditions: ["slaughter_city"] },
    { ...valid, redMoon: { ...valid.redMoon, lastWolfBlastPolicy: "unknown" } },
    { ...valid, redMoon: { ...valid.redMoon, arbitrary: true } },
    { ...valid, guard: { repeatPolicy: "netease_consecutive_nights_v1" } },
    {
      ...valid,
      roleSetups: valid.roleSetups.map((r) =>
        r.role === "idiot" ? { role: "hunter", count: 1 } : r,
      ),
    },
    {
      ...valid,
      roleSetups: valid.roleSetups.map((r) => (r.role === "wolf" ? { ...r, count: 2 } : r)),
    },
    { ...valid, roleSetups: [...valid.roleSetups.slice(0, -1), valid.roleSetups[0]] },
    { ...valid, selfDestruct: { enabledWindows: ["on_pre_vote", "on_pre_vote"] } },
    { ...valid, witch: { ...valid.witch, canSelfHeal: "always" } },
  ])
    expect(isRedMoonPreset(c)).toBe(false);
});
