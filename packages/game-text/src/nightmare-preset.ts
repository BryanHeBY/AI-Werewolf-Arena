import { copyEventData } from "./event-data";
export const NIGHTMARE_SHADOW_POLICY = "awa_nightmare_dreamer_v1" as const;
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
  nightmare: 1,
  villager: 4,
  seer: 1,
  witch: 1,
  hunter: 1,
  dreamer: 1,
};
/** Closed 12-player nightmare/dreamer board; unrelated experimental mechanisms are rejected. */
export function isNightmarePreset(input: unknown): boolean {
  try {
    const c = copyEventData(input) as Record<string, any>;
    const required = [
      "boardSize",
      "enableSheriff",
      "nightmareShadow",
      "seer",
      "roleSetups",
      "hooks",
      "selfDestruct",
      "witch",
      "hunter",
      "dreamer",
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
    const fearActionPolicy = c.nightmareShadow?.fearActionPolicy;
    const wolfActionPolicy = c.nightmareShadow?.wolfActionPolicy;
    if (
      !["optional", "required_when_legal"].includes(fearActionPolicy) ||
      !["standard", "no_blast_no_self_knife"].includes(wolfActionPolicy) ||
      !exact(c.nightmareShadow, {
        policy: NIGHTMARE_SHADOW_POLICY,
        fearActionPolicy,
        wolfActionPolicy,
      }) ||
      !exact(c.seer, { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" })
    )
      return false;
    if (
      c.witch?.canSelfHeal !== "disabled" ||
      !exact(c.witch, {
        canSelfHeal: c.witch.canSelfHeal,
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
      })
    )
      return false;
    return (
      exact(c.hunter, { deathActionPolicy: "awa_knife_or_exile_v1" }) &&
      exact(c.dreamer, { protectionPolicy: "awa_night_damage_v1" }) &&
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
