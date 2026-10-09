import { z } from "zod";
import {
  DEATH_REVEAL_POLICIES,
  LAST_WORDS_POLICIES,
  DEATH_ACTION_POLICIES,
  INSPECTION_POLICIES,
  GUARD_REPEAT_POLICIES,
  HIDDEN_WOLF_CAMP_INSPECTION_POLICIES,
  SEER_TARGET_POLICIES,
  SEER_ACTION_POLICIES,
  WITCH_KNIFE_VISIBILITY_POLICIES,
  WITCH_POTION_POLICIES,
  SHERIFF_ELECTION_POLICIES,
  SHERIFF_BADGE_POLICIES,
  EXILE_VOTE_POLICIES,
} from "./board";
import { ActionWindow, KnightDuelWindow, Role, WinCondition, WitchSelfHealRule } from "./identity";

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const strategies = z.enum(["min_id", "min_seat", "no_elimination", "no_kill"]);

/** Internal board shape shared by reverse configuration writing and reproduction. No defaults are added here. */
export const boardConfigSchema = z.strictObject({
  disclosure: z.strictObject({ deathRevealPolicy: z.enum(DEATH_REVEAL_POLICIES) }).optional(),
  lastWords: z.strictObject({ policy: z.enum(LAST_WORDS_POLICIES) }).optional(),
  boardSize: positive.max(128),
  enableSheriff: z.boolean(),
  initialSheriffSeat: positive.optional(),
  winConditions: z.array(z.enum(WinCondition)).optional(),
  winCondition: z.enum(WinCondition).optional(),
  hooks: z.strictObject({
    onDaybreak: z.boolean(),
    onPreElection: z.boolean(),
    onPreVote: z.boolean(),
    onPerSpeechGap: z.boolean(),
  }),
  roleSetups: z.array(z.strictObject({ role: z.enum(Role), count: nonnegative.max(128) })).min(1),
  selfDestruct: z.strictObject({ enabledWindows: z.array(z.enum(ActionWindow)) }).optional(),
  sheriff: z
    .strictObject({
      voteWeight: z.number().finite().positive().optional(),
      electionPolicy: z.enum(SHERIFF_ELECTION_POLICIES).optional(),
      badgePolicy: z.enum(SHERIFF_BADGE_POLICIES).optional(),
    })
    .optional(),
  voting: z.strictObject({ exilePolicy: z.enum(EXILE_VOTE_POLICIES) }).optional(),
  knight: z.strictObject({ enabledWindows: z.array(z.enum(KnightDuelWindow)) }).optional(),
  hunter: z.strictObject({ deathActionPolicy: z.enum(DEATH_ACTION_POLICIES) }).optional(),
  wolfKing: z.strictObject({ deathActionPolicy: z.enum(DEATH_ACTION_POLICIES) }).optional(),
  gargoyle: z.strictObject({ inspectionPolicy: z.enum(INSPECTION_POLICIES) }).optional(),
  psychic: z.strictObject({ inspectionPolicy: z.enum(INSPECTION_POLICIES) }).optional(),
  mirrorGirl: z.strictObject({ inspectionPolicy: z.enum(INSPECTION_POLICIES) }).optional(),
  guard: z.strictObject({ repeatPolicy: z.enum(GUARD_REPEAT_POLICIES) }).optional(),
  hiddenWolf: z
    .strictObject({ campInspection: z.enum(HIDDEN_WOLF_CAMP_INSPECTION_POLICIES) })
    .optional(),
  seer: z
    .strictObject({
      targetPolicy: z.enum(SEER_TARGET_POLICIES),
      actionPolicy: z.enum(SEER_ACTION_POLICIES),
    })
    .optional(),
  witch: z
    .strictObject({
      canSelfHeal: z.enum(WitchSelfHealRule).optional(),
      knifeVisibility: z.enum(WITCH_KNIFE_VISIBILITY_POLICIES).optional(),
      potionPolicy: z.enum(WITCH_POTION_POLICIES).optional(),
    })
    .optional(),
  tieBreaker: z
    .strictObject({
      exileVote: strategies.optional(),
      wolfKillVote: strategies.optional(),
      sheriffVote: strategies.optional(),
    })
    .optional(),
});
