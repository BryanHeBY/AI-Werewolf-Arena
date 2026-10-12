/**
 * Integration/scenario tests for mist raven preset configuration and setup contracts.
 * Input: the existing literal boards, original scenario actions and malformed
 * candidates. Output: the unchanged acceptance, roundtrip and state assertions.
 * Fixed policies, recorded literal expectations and rejection cases are the
 * oracle; these tests never generate replacement goldens from migrated rules.
 */
import { expect, test } from "bun:test";
import { isMistRavenPreset } from "../../src/rulesets";
function preset() {
  return {
    boardSize: 12,
    enableSheriff: true,
    roleSetups: [
      { role: "alchemist", count: 1 },
      { role: "raven_claw_wolf", count: 1 },
      { role: "wolf", count: 3 },
      { role: "villager", count: 4 },
      { role: "seer", count: 1 },
      { role: "dreamer", count: 1 },
      { role: "idiot", count: 1 },
    ],
    mistRaven: { policy: "awa_mist_raven_v1" },
    dreamer: { protectionPolicy: "netease_2026_night_immunity_v1" },
    seer: {
      targetPolicy: "awa_alive_v1",
      actionPolicy: "awa_required_when_legal_v1",
    },
    winConditions: ["slaughter_side"],
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
    sheriff: {
      electionPolicy: "awa_nomination_offstage_pk_v1",
      badgePolicy: "awa_holder_choice_v1",
      voteWeight: 1.5,
    },
    voting: { exilePolicy: "awa_one_pk_v1" },
    tieBreaker: {
      sheriffVote: "no_elimination",
      wolfKillVote: "min_id",
      exileVote: "no_elimination",
    },
    hooks: {
      onPreElection: true,
      onDaybreak: true,
      onPerSpeechGap: true,
      onPreVote: true,
    },
    selfDestruct: {
      enabledWindows: ["on_pre_election", "on_daybreak", "on_per_speech_gap", "on_pre_vote"],
    },
  };
}
test("only the frozen exact native board is eligible irrespective of declaration order", () => {
  const c = preset();
  expect(isMistRavenPreset(c)).toBe(true);
  c.roleSetups.reverse();
  c.selfDestruct.enabledWindows.reverse();
  expect(isMistRavenPreset(c)).toBe(true);
  expect(
    isMistRavenPreset({
      ...c,
      winConditions: undefined,
      winCondition: "slaughter_side",
    }),
  ).toBe(false);
  const { winConditions, ...legacy } = c;
  expect(winConditions).toEqual(["slaughter_side"]);
  expect(isMistRavenPreset({ ...legacy, winCondition: "slaughter_side" })).toBe(true);
});
test("unsupported copied roles, dreams, goals and window variants stay rejected", () => {
  for (const edit of [
    (c: ReturnType<typeof preset>) => {
      c.roleSetups[0]!.role = "witch";
    },
    (c: ReturnType<typeof preset>) => {
      c.roleSetups[0]!.count = 2;
    },
    (c: ReturnType<typeof preset>) => {
      c.dreamer.protectionPolicy = "awa_active_effects_v1";
    },
    (c: ReturnType<typeof preset>) => {
      c.winConditions = ["slaughter_city"];
    },
    (c: ReturnType<typeof preset>) => {
      c.hooks.onPerSpeechGap = false;
    },
    (c: ReturnType<typeof preset>) => {
      c.selfDestruct.enabledWindows.pop();
    },
    (c: ReturnType<typeof preset>) => {
      c.selfDestruct.enabledWindows[0] = "on_pre_vote";
    },
    (c: ReturnType<typeof preset>) => {
      c.sheriff.voteWeight = 1;
    },
    (c: ReturnType<typeof preset>) => {
      c.sheriff.badgePolicy = "awa_next_seat_v1";
    },
    (c: ReturnType<typeof preset>) => {
      c.sheriff.electionPolicy = "awa_final_candidates_v1";
    },
    (c: ReturnType<typeof preset>) => {
      c.seer.actionPolicy = "awa_optional_v1";
    },
    (c: ReturnType<typeof preset>) => {
      c.tieBreaker.wolfKillVote = "no_kill";
    },
    (c: ReturnType<typeof preset>) => {
      c.lastWords.policy = "netease_2017_day_and_first_night_v1";
    },
    (c: ReturnType<typeof preset>) => {
      c.voting.exilePolicy = "awa_direct_v1";
    },
  ]) {
    const c = preset();
    edit(c);
    expect(isMistRavenPreset(c)).toBe(false);
  }
  for (const field of Object.keys(preset())) {
    const c: Record<string, unknown> = preset();
    delete c[field];
    expect(isMistRavenPreset(c)).toBe(false);
  }
  expect(isMistRavenPreset({ ...preset(), magician: {} })).toBe(false);
  expect(
    isMistRavenPreset({
      ...preset(),
      mistRaven: { policy: "awa_mist_raven_v1", extra: true },
    }),
  ).toBe(false);
});
test("accessors are not read and proxy exceptions fail closed", () => {
  let called = 0;
  const c = preset();
  Object.defineProperty(c, "boardSize", {
    get() {
      called++;
      throw Error("getter");
    },
  });
  expect(isMistRavenPreset(c)).toBe(false);
  expect(called).toBe(0);
  expect(
    isMistRavenPreset(
      new Proxy(preset(), {
        ownKeys() {
          called++;
          throw Error("trap");
        },
      }),
    ),
  ).toBe(false);
  expect(called).toBe(1);
});
