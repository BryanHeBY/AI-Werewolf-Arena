import {
  ActionWindow,
  Role,
  WinCondition,
  WitchSelfHealRule,
  type BoardConfig,
} from "../../core/domain/model";
import { DEMON_HUNTER_POLICY } from "@ai-werewolf-arena/game-text";
/** Candidate fixture until the full Red Moon lifecycle is registered. */
export const redMoonTwelveConfig: BoardConfig = {
  boardSize: 12,
  enableSheriff: true,
  redMoon: { policy: "awa_red_moon_demon_v1", lastWolfBlastPolicy: "ends_game" },
  demonHunter: { policy: DEMON_HUNTER_POLICY },
  winConditions: [WinCondition.SlaughterSide],
  seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
  witch: {
    canSelfHeal: WitchSelfHealRule.Disabled,
    knifeVisibility: "awa_with_heal_v1",
    potionPolicy: "awa_one_native_v1",
  },
  hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
  selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
  sheriff: {
    electionPolicy: "awa_final_candidates_v1",
    badgePolicy: "awa_next_seat_v1",
    voteWeight: 1.5,
  },
  tieBreaker: { sheriffVote: "min_seat", wolfKillVote: "min_id", exileVote: "min_id" },
  voting: { exilePolicy: "awa_direct_v1" },
  disclosure: { deathRevealPolicy: "awa_hidden_v1" },
  lastWords: { policy: "awa_initial_wave_v1" },
  roleSetups: [
    { role: Role.Wolf, count: 3 },
    { role: Role.RedMoonApostle, count: 1 },
    { role: Role.Villager, count: 4 },
    { role: Role.Seer, count: 1 },
    { role: Role.Witch, count: 1 },
    { role: Role.DemonHunter, count: 1 },
    { role: Role.Idiot, count: 1 },
  ],
};
