/**
 * Responsibility: own stable board-policy identifiers and data unions used by facts.
 * Input: declared machine policy IDs; output: original constants/arrays/types.
 * These identifiers select a declared policy but do not prove a board supported
 * or execute its effects. Rulesets own composition validation and domain features
 * own resource/state behavior. Array mutability and insertion order stay unchanged.
 */
export const ANIMAL_DREAM_POLICY = "awa_animal_dream_v1" as const;
export const CAT_SKIPPED_VOTE_POLICIES = [
  "awa_wait_for_actual_exile_v1",
  "awa_expire_on_skipped_day_v1",
] as const;
export const PUFFER_BALLOT_POLICIES = ["awa_final_ballot_v1", "awa_first_ballot_v1"] as const;
export const BEAR_SIGNAL_POLICIES = ["awa_night_open_v1", "netease_dawn_live_v1"] as const;
export type CatSkippedVotePolicy = (typeof CAT_SKIPPED_VOTE_POLICIES)[number];
export type PufferBallotPolicy = (typeof PUFFER_BALLOT_POLICIES)[number];
export type BearSignalPolicy = (typeof BEAR_SIGNAL_POLICIES)[number];

export const NIGHTMARE_SHADOW_POLICY = "awa_nightmare_dreamer_v1" as const;

export const EVIL_KNIGHT_POLICY = "awa_evil_knight_v1" as const;

export const PURE_WHITE_POLICY = "awa_pure_white_night_v1" as const;
