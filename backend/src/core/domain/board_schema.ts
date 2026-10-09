import { z } from "zod";
import {
  GUARD_REPEAT_POLICIES,
  HIDDEN_WOLF_CAMP_INSPECTION_POLICIES,
  SEER_TARGET_POLICIES,
  SEER_ACTION_POLICIES,
} from "./board";
import { ActionWindow, KnightDuelWindow, Role, WinCondition, WitchSelfHealRule } from "./identity";

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const strategies = z.enum(["min_id", "min_seat", "no_elimination", "no_kill"]);

/** Internal board shape shared by reverse configuration writing and reproduction. No defaults are added here. */
export const boardConfigSchema = z.strictObject({
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
  sheriff: z.strictObject({ voteWeight: z.number().finite().positive().optional() }).optional(),
  knight: z.strictObject({ enabledWindows: z.array(z.enum(KnightDuelWindow)) }).optional(),
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
  witch: z.strictObject({ canSelfHeal: z.enum(WitchSelfHealRule).optional() }).optional(),
  tieBreaker: z
    .strictObject({
      exileVote: strategies.optional(),
      wolfKillVote: strategies.optional(),
      sheriffVote: strategies.optional(),
    })
    .optional(),
});
