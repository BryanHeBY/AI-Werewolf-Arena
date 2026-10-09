import {
  GHOST_BRIDE_GOAL,
  GHOST_BRIDE_POLICY,
  GHOST_BRIDE_ROLE,
  copyEventData,
} from "@ai-werewolf-arena/game-text";
import { ActionWindow, WitchSelfHealRule, type BoardConfig } from "../../../../core/domain";
export type GhostBrideBoard = BoardConfig & { ghostBride: { policy: typeof GHOST_BRIDE_POLICY } };
const deck: Readonly<Record<string, number>> = Object.freeze({
  wolf: 3,
  villager: 4,
  seer: 1,
  witch: 1,
  hunter: 1,
  guard: 1,
  [GHOST_BRIDE_ROLE]: 1,
});
function exact(value: unknown, keys: readonly string[]): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((k) => Object.hasOwn(value, k))
  );
}
/** Validate the normalized finite preset, including internal callers that bypass public schema. */
export function assertGhostBridePreset(config: BoardConfig): asserts config is GhostBrideBoard {
  let c: GhostBrideBoard;
  try {
    c = copyEventData(config) as GhostBrideBoard;
  } catch {
    throw new Error("ghost_bride_preset_invalid");
  }
  const required = [
      "boardSize",
      "enableSheriff",
      "ghostBride",
      "roleSetups",
      "hooks",
      "selfDestruct",
      "seer",
      "guard",
      "witch",
      "hunter",
      "sheriff",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
    ],
    allowed = [...required, "winConditions", "winCondition"];
  if (
    !c ||
    typeof c !== "object" ||
    Array.isArray(c) ||
    !required.every((k) => Object.hasOwn(c, k)) ||
    Object.keys(c).some((k) => !allowed.includes(k)) ||
    !Array.isArray(c.roleSetups) ||
    c.roleSetups.length !== 7
  )
    throw new Error("ghost_bride_preset_invalid");
  const counts: Record<string, number> = {};
  for (const entry of c.roleSetups) {
    if (
      !exact(entry, ["role", "count"]) ||
      typeof entry.role !== "string" ||
      !Object.hasOwn(deck, entry.role) ||
      !Number.isSafeInteger(entry.count) ||
      entry.count < 1 ||
      Object.hasOwn(counts, entry.role)
    )
      throw new Error("ghost_bride_preset_invalid");
    counts[entry.role] = entry.count;
  }
  if (Object.hasOwn(c, "winConditions") && !Array.isArray(c.winConditions))
    throw new Error("ghost_bride_preset_invalid");
  const goals = c.winConditions ?? (c.winCondition ? [c.winCondition] : []),
    windows = c.selfDestruct?.enabledWindows;
  if (
    c.boardSize !== 12 ||
    Object.keys(counts).length !== Object.keys(deck).length ||
    !Object.entries(deck).every(([role, count]) => counts[role] === count) ||
    !exact(c.ghostBride, ["policy"]) ||
    c.ghostBride.policy !== GHOST_BRIDE_POLICY ||
    !Array.isArray(goals) ||
    goals.length !== 1 ||
    (goals[0] as unknown) !== GHOST_BRIDE_GOAL ||
    (Object.hasOwn(c, "winCondition") && (c.winCondition as unknown) !== GHOST_BRIDE_GOAL) ||
    c.enableSheriff !== true ||
    !exact(c.seer, ["targetPolicy", "actionPolicy"]) ||
    c.seer?.targetPolicy !== "awa_alive_v1" ||
    c.seer.actionPolicy !== "awa_required_when_legal_v1" ||
    !exact(c.guard, ["repeatPolicy"]) ||
    c.guard?.repeatPolicy !== "netease_consecutive_nights_v1" ||
    !exact(c.witch, ["canSelfHeal", "knifeVisibility", "potionPolicy"]) ||
    c.witch?.canSelfHeal !== WitchSelfHealRule.Disabled ||
    c.witch.knifeVisibility !== "awa_with_heal_v1" ||
    c.witch.potionPolicy !== "awa_one_native_v1" ||
    !exact(c.hunter, ["deathActionPolicy"]) ||
    c.hunter?.deathActionPolicy !== "awa_knife_or_exile_v1" ||
    !exact(c.sheriff, ["electionPolicy", "badgePolicy", "voteWeight"]) ||
    c.sheriff?.electionPolicy !== "awa_final_candidates_v1" ||
    c.sheriff.badgePolicy !== "awa_next_seat_v1" ||
    c.sheriff.voteWeight !== 1.5 ||
    !exact(c.tieBreaker, ["sheriffVote", "wolfKillVote", "exileVote"]) ||
    c.tieBreaker?.sheriffVote !== "min_seat" ||
    c.tieBreaker.wolfKillVote !== "min_id" ||
    c.tieBreaker.exileVote !== "min_id" ||
    !exact(c.voting, ["exilePolicy"]) ||
    c.voting?.exilePolicy !== "awa_direct_v1" ||
    !exact(c.disclosure, ["deathRevealPolicy"]) ||
    c.disclosure?.deathRevealPolicy !== "awa_hidden_v1" ||
    !exact(c.lastWords, ["policy"]) ||
    c.lastWords?.policy !== "awa_initial_wave_v1" ||
    !exact(c.hooks, ["onPreElection", "onPreVote", "onDaybreak", "onPerSpeechGap"]) ||
    c.hooks.onPreElection !== true ||
    c.hooks.onPreVote !== true ||
    c.hooks.onDaybreak !== false ||
    c.hooks.onPerSpeechGap !== false ||
    !exact(c.selfDestruct, ["enabledWindows"]) ||
    !Array.isArray(windows) ||
    windows.length !== 2 ||
    new Set(windows).size !== 2 ||
    !windows.includes(ActionWindow.OnPreElection) ||
    !windows.includes(ActionWindow.OnPreVote)
  )
    throw new Error("ghost_bride_preset_invalid");
}
