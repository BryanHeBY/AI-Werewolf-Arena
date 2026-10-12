import { expect, test } from "bun:test";
import { isAnimalDreamPreset } from "@ai-werewolf-arena/game-text";
const base = {
  boardSize: 12,
  enableSheriff: true,
  animalDream: {
    policy: "awa_animal_dream_v1",
    eliminationPriority: "awa_wolf_priority_v1",
  },
  whiteCat: { skippedVotePolicy: "awa_wait_for_actual_exile_v1" },
  pufferfish: { ballotPolicy: "awa_final_ballot_v1" },
  bear: { signalPolicy: "netease_dawn_live_v1" },
  wolfBeauty: { deathLinkPolicy: "awa_exile_poison_v1" },
  roleSetups: [
    { role: "wolf", count: 3 },
    { role: "wolf_beauty", count: 1 },
    { role: "villager", count: 4 },
    { role: "white_cat", count: 1 },
    { role: "fox_cub", count: 1 },
    { role: "bear", count: 1 },
    { role: "pufferfish", count: 1 },
  ],
  winConditions: ["slaughter_side"],
  hooks: {
    onDaybreak: false,
    onPreElection: true,
    onPreVote: true,
    onPerSpeechGap: false,
  },
  selfDestruct: { enabledWindows: ["on_pre_election", "on_pre_vote"] },
  tieBreaker: {
    sheriffVote: "no_elimination",
    wolfKillVote: "min_id",
    exileVote: "no_elimination",
  },
  voting: { exilePolicy: "awa_one_pk_v1" },
  disclosure: { deathRevealPolicy: "awa_hidden_v1" },
  lastWords: { policy: "awa_initial_wave_v1" },
  sheriff: {
    electionPolicy: "awa_nomination_offstage_pk_v1",
    badgePolicy: "awa_holder_choice_v1",
    voteWeight: 1.5,
  },
};
for (const skipped of ["awa_wait_for_actual_exile_v1", "awa_expire_on_skipped_day_v1"])
  for (const ballot of ["awa_final_ballot_v1", "awa_first_ballot_v1"])
    test(`finite Cat/Puffer ${skipped}/${ballot}`, () => {
      const c = {
        ...base,
        whiteCat: { skippedVotePolicy: skipped },
        pufferfish: { ballotPolicy: ballot },
      };
      expect(isAnimalDreamPreset(c)).toBe(true);
      expect(isAnimalDreamPreset(JSON.parse(JSON.stringify(c)))).toBe(true);
    });
const mutations: Record<string, (c: any) => void> = {
  "wrong signal at night-open": (c) => (c.bear.signalPolicy = "awa_night_open_v1"),
  "unsupported good simultaneous priority": (c) =>
    (c.animalDream.eliminationPriority = "awa_good_priority_v1"),
  "unknown Cat option": (c) => (c.whiteCat.skippedVotePolicy = "auto"),
  "unknown Puffer option": (c) => (c.pufferfish.ballotPolicy = "all"),
  "extra inventory parameter": (c) => (c.pufferfish.uses = 2),
  "wrong native count": (c) => {
    c.roleSetups[0].count = 2;
    c.roleSetups[2].count = 5;
  },
  "duplicate role": (c) => (c.roleSetups[6] = { role: "bear", count: 1 }),
  "unsupported Hunter mixture": (c) => (c.roleSetups[5] = { role: "hunter", count: 1 }),
  "irrelevant Witch parameter": (c) => (c.witch = { canSelfHeal: "disabled" }),
  "extra arbitrary global field": (c) => (c.extra = true),
  "duplicate window": (c) => (c.selfDestruct.enabledWindows = ["on_pre_vote", "on_pre_vote"]),
  "contradictory two win forms": (c) => (c.winCondition = "slaughter_city"),
};
for (const [name, mutate] of Object.entries(mutations))
  test(`reject ${name}`, () => {
    const c = structuredClone(base);
    mutate(c);
    expect(isAnimalDreamPreset(c)).toBe(false);
  });
test("finite reader rejects getter without running it", () => {
  let calls = 0;
  const c = structuredClone(base);
  Object.defineProperty(c, "bear", {
    enumerable: true,
    get() {
      calls++;
      return { signalPolicy: "netease_dawn_live_v1" };
    },
  });
  expect(isAnimalDreamPreset(c)).toBe(false);
  expect(calls).toBe(0);
});
