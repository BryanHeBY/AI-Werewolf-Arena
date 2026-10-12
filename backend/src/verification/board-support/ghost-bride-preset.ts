/**
 * Responsibility: own the frozen archive support check for ghost-bride boards.
 * Input: inert normalized board data from a replay archive; output: the finite
 * supported-board verdict preserved from Git 80ce15f. Local verification owns
 * this algorithm independently; it never calls production ruleset predicates,
 * accepts raw configuration on schema alone, authorizes actions or writes state.
 * Public contract supplies only inert copying, facts and stable policy IDs;
 * Node ingress must reject hostile objects before this reader reflects data.
 */
import {
  GHOST_BRIDE_GOAL,
  GHOST_BRIDE_POLICY,
  GHOST_BRIDE_ROLE,
} from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
interface PresetCandidate {
  boardSize: number;
  enableSheriff: boolean;
  ghostBride: { policy: string };
  roleSetups: Array<{ role: string; count: number }>;
  winConditions?: string[];
  winCondition?: string;
  seer: { targetPolicy: string; actionPolicy: string };
  guard: { repeatPolicy: string };
  witch: { canSelfHeal: string; knifeVisibility: string; potionPolicy: string };
  hunter: { deathActionPolicy: string };
  sheriff: { electionPolicy: string; badgePolicy: string; voteWeight: number };
  tieBreaker: { sheriffVote: string; wolfKillVote: string; exileVote: string };
  voting: { exilePolicy: string };
  disclosure: { deathRevealPolicy: string };
  lastWords: { policy: string };
  hooks: {
    onPreElection: boolean;
    onPreVote: boolean;
    onDaybreak: boolean;
    onPerSpeechGap: boolean;
  };
  selfDestruct: { enabledWindows: string[] };
}
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
export function isGhostBridePreset(config: unknown): boolean {
  let c: PresetCandidate;
  try {
    c = copyEventData(config) as PresetCandidate;
  } catch {
    return false;
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
    return false;
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
      return false;
    counts[entry.role] = entry.count;
  }
  if (Object.hasOwn(c, "winConditions") && !Array.isArray(c.winConditions)) return false;
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
    c.witch?.canSelfHeal !== "disabled" ||
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
    !windows.includes("on_pre_election") ||
    !windows.includes("on_pre_vote")
  )
    return false;
  return true;
}
