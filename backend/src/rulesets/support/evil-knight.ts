/**
 * Owns the existing finite evil-knight composition predicate for production setup.
 * Inputs are inert normalized board data; outputs are the original support
 * verdict with unchanged field, deck, goal and policy checks. It never applies
 * game effects, chooses an actor or authorizes a turn. Archive verification has
 * a separately owned predicate and must not call this production implementation.
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { EVIL_KNIGHT_POLICY } from "@ai-werewolf-arena/game-contract";

function exact(value: unknown, expected: Record<string, unknown>): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === Object.keys(expected).length &&
    Object.entries(expected).every(
      ([key, v]) => Object.hasOwn(value, key) && (value as Record<string, unknown>)[key] === v,
    )
  );
}
const deck: Readonly<Record<string, number>> = {
  wolf: 3,
  evil_knight: 1,
  villager: 4,
  seer: 1,
  witch: 1,
  hunter: 1,
  guard: 1,
};
/** Closed 12-player evil-knight board; unrelated experimental mechanisms are rejected. */
export function isEvilKnightPreset(input: unknown): boolean {
  try {
    const c = copyEventData(input) as Record<string, any>;
    const required = [
      "boardSize",
      "enableSheriff",
      "evilKnight",
      "seer",
      "roleSetups",
      "hooks",
      "selfDestruct",
      "witch",
      "hunter",
      "guard",
      "sheriff",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
    ];
    const allowed = [...required, "winCondition", "winConditions"];
    if (
      !c ||
      Array.isArray(c) ||
      required.some((key) => !Object.hasOwn(c, key)) ||
      Object.keys(c).some((key) => !allowed.includes(key)) ||
      c.boardSize !== 12 ||
      c.enableSheriff !== true
    )
      return false;
    if (!Array.isArray(c.roleSetups) || c.roleSetups.length !== Object.keys(deck).length)
      return false;
    const seen = new Set<string>();
    for (const row of c.roleSetups) {
      if (
        !row ||
        typeof row.role !== "string" ||
        !Object.hasOwn(deck, row.role) ||
        seen.has(row.role) ||
        !exact(row, { role: row.role, count: deck[row.role] })
      )
        return false;
      seen.add(row.role);
    }
    if (Object.hasOwn(c, "winConditions") && !Array.isArray(c.winConditions)) return false;
    const goals = c.winConditions ?? (c.winCondition ? [c.winCondition] : []);
    if (
      !Array.isArray(goals) ||
      goals.length !== 1 ||
      goals[0] !== "slaughter_side" ||
      (Object.hasOwn(c, "winCondition") && c.winCondition !== "slaughter_side")
    )
      return false;
    const shotPolicy = c.evilKnight?.shotPolicy;
    if (
      !["night_shot_immune", "hunter_shot_bypasses"].includes(shotPolicy) ||
      !exact(c.evilKnight, { policy: EVIL_KNIGHT_POLICY, shotPolicy }) ||
      !exact(c.seer, { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" })
    )
      return false;
    if (
      !["disabled", "first_night_only"].includes(c.witch?.canSelfHeal) ||
      !exact(c.witch, {
        canSelfHeal: c.witch.canSelfHeal,
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
      })
    )
      return false;
    return (
      exact(c.hunter, { deathActionPolicy: "awa_knife_or_exile_v1" }) &&
      exact(c.guard, { repeatPolicy: "netease_consecutive_nights_v1" }) &&
      exact(c.sheriff, {
        electionPolicy: "awa_nomination_offstage_pk_v1",
        badgePolicy: "awa_holder_choice_v1",
        voteWeight: 1.5,
      }) &&
      exact(c.tieBreaker, {
        sheriffVote: "no_elimination",
        wolfKillVote: "min_id",
        exileVote: "no_elimination",
      }) &&
      exact(c.voting, { exilePolicy: "awa_one_pk_v1" }) &&
      exact(c.disclosure, { deathRevealPolicy: "awa_hidden_v1" }) &&
      exact(c.lastWords, { policy: "awa_initial_wave_v1" }) &&
      exact(c.hooks, {
        onDaybreak: false,
        onPreElection: true,
        onPreVote: true,
        onPerSpeechGap: false,
      }) &&
      !!c.selfDestruct &&
      Object.keys(c.selfDestruct).length === 1 &&
      Array.isArray(c.selfDestruct.enabledWindows) &&
      c.selfDestruct.enabledWindows.length === 2 &&
      new Set(c.selfDestruct.enabledWindows).size === 2 &&
      c.selfDestruct.enabledWindows.every((v: string) =>
        ["on_pre_election", "on_pre_vote"].includes(v),
      )
    );
  } catch {
    return false;
  }
}
