/**
 * Unit tests for the finite Scholar Mentor production support predicate.
 * Literal canonical boards, reordered decks, removed fields and policy patches
 * are the independent acceptance/rejection oracle. The original dynamic case
 * tables and accessor counter remain unchanged; no World, model or game runs.
 */
import { test, expect } from "bun:test";
import { isScholarMentorPreset as accepts } from "../../../src/rulesets";
const config = {
  boardSize: 12,
  scholarMentor: { policy: "awa_scholar_mentor_twelve_v1" },
  enableSheriff: true,
  seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
  winConditions: ["slaughter_side"],
  hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
  selfDestruct: { enabledWindows: ["on_pre_election", "on_pre_vote"] },
  witch: {
    canSelfHeal: "disabled",
    knifeVisibility: "awa_with_heal_v1",
    potionPolicy: "awa_one_native_v1",
  },
  guard: { repeatPolicy: "awa_last_action_v1" },
  sheriff: {
    electionPolicy: "awa_nomination_offstage_pk_v1",
    badgePolicy: "awa_holder_choice_v1",
    voteWeight: 1.5,
  },
  tieBreaker: {
    sheriffVote: "no_elimination",
    wolfKillVote: "min_id",
    exileVote: "no_elimination",
  },
  voting: { exilePolicy: "awa_one_pk_v1" },
  disclosure: { deathRevealPolicy: "awa_hidden_v1" },
  lastWords: { policy: "awa_initial_wave_v1" },
  roleSetups: [
    { role: "wolf", count: 3 },
    { role: "night_mentor", count: 1 },
    { role: "villager", count: 4 },
    { role: "seer", count: 1 },
    { role: "witch", count: 1 },
    { role: "guard", count: 1 },
    { role: "day_scholar", count: 1 },
  ],
};
test("finite Scholar Mentor preset accepts canonical deck and reordered rows", () => {
  expect(accepts(config)).toBe(true);
  expect(accepts({ ...config, roleSetups: [...config.roleSetups].reverse() })).toBe(true);
});
for (const key of Object.keys(config))
  test("finite preset requires " + key, () => {
    const bad: Record<string, unknown> = structuredClone(config);
    delete bad[key];
    expect(accepts(bad)).toBe(false);
  });
for (const [name, patch] of Object.entries({
  unknown: { unexpected: true },
  size: { boardSize: 13 },
  sheriff: { enableSheriff: false },
  policy: { scholarMentor: { policy: "other" } },
  overrides: { scholarMentor: { policy: "awa_scholar_mentor_twelve_v1", extra: 1 } },
  duplicate: { roleSetups: [...config.roleSetups.slice(0, -1), config.roleSetups[0]] },
  count: { roleSetups: config.roleSetups.map((x) => (x.role === "wolf" ? { ...x, count: 4 } : x)) },
  foreign: {
    roleSetups: config.roleSetups.map((x) => (x.role === "guard" ? { ...x, role: "hunter" } : x)),
  },
  win: { winConditions: ["slaughter_city"] },
  mismatch: { winCondition: "slaughter_city" },
  guard: { guard: { repeatPolicy: "other" } },
  witch: { witch: { ...config.witch, potionPolicy: "both" } },
}))
  test("finite preset rejects " + name, () => expect(accepts({ ...config, ...patch })).toBe(false));
test("finite preset rejects accessor without executing it", () => {
  let reads = 0;
  const c = { ...config };
  Object.defineProperty(c, "scholarMentor", {
    get() {
      reads++;
      return config.scholarMentor;
    },
  });
  expect(accepts(c)).toBe(false);
  expect(reads).toBe(0);
});
