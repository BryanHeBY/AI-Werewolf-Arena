import { z } from "zod";
import {
  EVENT_PACK_IDS,
  CUPID_POLICIES,
  DEBATER_POLICIES,
  DREAM_PROTECTION_POLICIES,
  BEAUTY_DEATH_LINK_POLICIES,
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
  redMoon: z
    .strictObject({
      policy: z.literal("awa_red_moon_demon_v1"),
      lastWolfBlastPolicy: z.enum(["ends_game", "forbidden"]),
    })
    .optional(),
  nightmareShadow: z
    .strictObject({
      policy: z.literal("awa_nightmare_dreamer_v1"),
      fearActionPolicy: z.enum(["optional", "required_when_legal"]),
      wolfActionPolicy: z.enum(["standard", "no_blast_no_self_knife"]),
    })
    .optional(),
  evilKnight: z
    .strictObject({
      policy: z.literal("awa_evil_knight_v1"),
      shotPolicy: z.enum(["night_shot_immune", "hunter_shot_bypasses"]),
    })
    .optional(),
  pureWhite: z
    .strictObject({
      policy: z.literal("awa_pure_white_night_v1"),
      eliminationPriority: z.enum(["awa_good_priority_v1", "awa_wolf_priority_v1"]),
    })
    .optional(),
  wolfWitch: z.strictObject({ policy: z.literal("awa_pure_white_night_v1") }).optional(),
  demonHunter: z.strictObject({ policy: z.literal("awa_netease_demon_hunter_v1") }).optional(),
  ghostBride: z.strictObject({ policy: z.literal("awa_melbourne_ghost_bride_v1") }).optional(),
  events: z.strictObject({ pack: z.enum(EVENT_PACK_IDS) }).optional(),
  lonelyGirl: z.strictObject({ policy: z.literal("awa_netease_lonely_girl_v1") }).optional(),
  wildChild: z.strictObject({ policy: z.literal("awa_lui_meme_wild_child_v1") }).optional(),
  shapeshifter: z
    .strictObject({ policy: z.literal("awa_netease_shapeshifter_two_extra_villagers_v1") })
    .optional(),
  thief: z.strictObject({ policy: z.literal("lui_meme_thief_two_extra_villagers_v1") }).optional(),
  debater: z.strictObject({ policy: z.enum(DEBATER_POLICIES) }).optional(),
  cupid: z.strictObject({ policy: z.enum(CUPID_POLICIES) }).optional(),
  dreamer: z.strictObject({ protectionPolicy: z.enum(DREAM_PROTECTION_POLICIES) }).optional(),
  wolfBeauty: z.strictObject({ deathLinkPolicy: z.enum(BEAUTY_DEATH_LINK_POLICIES) }).optional(),
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
