/**
 * Integration/scenario tests for magician public contract configuration and setup contracts.
 * Input: the existing literal boards, original scenario actions and malformed
 * candidates. Output: the unchanged acceptance, roundtrip and state assertions.
 * Fixed policies, recorded literal expectations and rejection cases are the
 * oracle; these tests never generate replacement goldens from migrated rules.
 */
import { expect, test } from "bun:test";
import { isMagicianPreset } from "../../../src/rulesets";
import {
  readMagicianExchangeFact,
  readMagicianOwnExchangeFact,
} from "@ai-werewolf-arena/game-text";
function board(
  firstNight: 1 | 2 = 1,
  deathShotTargetPolicy: "original" | "exchanged" = "original",
) {
  return {
    boardSize: 12,
    enableSheriff: true,
    magician: { policy: "awa_magician_wolf_king_v1", firstNight, deathShotTargetPolicy },
    hunter: { deathActionPolicy: "awa_qualified_sources_v1" },
    wolfKing: { deathActionPolicy: "awa_qualified_sources_v1" },
    roleSetups: Object.entries({
      wolf: 3,
      wolf_king: 1,
      villager: 4,
      seer: 1,
      witch: 1,
      hunter: 1,
      magician: 1,
    }).map(([role, count]) => ({ role, count })),
    winConditions: ["slaughter_side"],
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    witch: {
      canSelfHeal: "disabled",
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    voting: { exilePolicy: "awa_one_pk_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
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
    hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: ["on_pre_election", "on_pre_vote"] },
  };
}
for (const firstNight of [1, 2] as const)
  for (const shot of ["original", "exchanged"] as const)
    test(
      "Magician finite preset accepts explicit policy combination/" + firstNight + "/" + shot,
      () => {
        expect(isMagicianPreset(board(firstNight, shot))).toBe(true);
      },
    );
test("Magician finite preset rejects unsupported mixtures and policy changes", () => {
  const mutations: Array<(c: ReturnType<typeof board>) => void> = [
    (c) => {
      c.boardSize = 13;
    },
    (c) => {
      c.enableSheriff = false;
    },
    (c) => {
      c.roleSetups[0]!.count = 4;
    },
    (c) => {
      c.roleSetups[0]!.role = "nightmare";
    },
    (c) => {
      c.roleSetups.push({ ...c.roleSetups[0]! });
    },
    (c) => {
      c.winConditions.push("wolf_reach_half");
    },
    (c) => {
      c.hunter.deathActionPolicy = "implicit";
    },
    (c) => {
      c.wolfKing.deathActionPolicy = "awa_knife_or_exile_v1";
    },
    (c) => {
      c.witch.canSelfHeal = "always";
    },
    (c) => {
      c.magician.policy = "implicit";
    },
    (c) => {
      Object.defineProperty(c.magician, "firstNight", { value: 3 });
    },
    (c) => {
      Object.defineProperty(c.magician, "deathShotTargetPolicy", { value: "implicit" });
    },
    (c) => {
      Object.defineProperty(c, "guard", { value: {}, enumerable: true });
    },
    (c) => {
      c.selfDestruct.enabledWindows = ["on_pre_vote", "on_pre_vote"];
    },
  ];
  for (const mutate of mutations) {
    const c = board();
    mutate(c);
    expect(isMagicianPreset(c)).toBe(false);
  }
});
test("Magician finite preset never executes accessor inputs", () => {
  const c = board();
  let reads = 0;
  Object.defineProperty(c.magician, "firstNight", {
    get() {
      reads++;
      throw new Error("must_not_read");
    },
  });
  expect(isMagicianPreset(c)).toBe(false);
  expect(reads).toBe(0);
});
test("Magician exchange facts are exact, detached and support self exchange or explicit pass", () => {
  const input = { actorId: 1, day: 1, pair: [1, 3] as [number, number] };
  const fact = readMagicianExchangeFact("magician_exchange_committed", input);
  expect(fact).toEqual(input);
  expect(fact).not.toBe(input);
  expect(fact!.pair).not.toBe(input.pair);
  expect(
    readMagicianExchangeFact("magician_exchange_committed", { actorId: 1, day: 1, pair: null }),
  ).not.toBeNull();
  expect(
    readMagicianOwnExchangeFact("magician_exchange_committed", { day: 1, pair: [1, 3] }),
  ).toEqual({ day: 1, pair: [1, 3] });
  expect(readMagicianOwnExchangeFact("magician_exchange_committed", input)).toBeNull();
});
test("Magician fact readers reject malformed or overexposed facts", () => {
  for (const pair of [[3, 1], [1, 1], [0, 2], [1, 2, 3], [], [1, Number.MAX_SAFE_INTEGER], "1,2"]) {
    expect(
      readMagicianExchangeFact("magician_exchange_committed", { actorId: 1, day: 1, pair }),
    ).toBeNull();
  }
  expect(readMagicianExchangeFact("wrong", { actorId: 1, day: 1, pair: null })).toBeNull();
  expect(
    readMagicianExchangeFact("magician_exchange_committed", {
      actorId: 1,
      day: 1,
      pair: null,
      secret: 1,
    }),
  ).toBeNull();
  expect(
    readMagicianExchangeFact("magician_exchange_committed", { actorId: 1, day: 0, pair: null }),
  ).toBeNull();
  let reads = 0;
  const bad = { actorId: 1, day: 1, pair: null };
  Object.defineProperty(bad, "pair", {
    get() {
      reads++;
      throw new Error("must_not_read");
    },
  });
  expect(readMagicianExchangeFact("magician_exchange_committed", bad)).toBeNull();
  expect(reads).toBe(0);
});
