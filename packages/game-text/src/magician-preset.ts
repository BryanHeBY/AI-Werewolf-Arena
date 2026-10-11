import { isWolfSorcererPreset } from "./wolf-sorcerer-preset";
import { isTricksterPreset } from "./trickster-preset";
import { copyEventData } from "./event-data";
const deck: Readonly<Record<string, number>> = {
  wolf: 3,
  wolf_king: 1,
  villager: 4,
  seer: 1,
  witch: 1,
  hunter: 1,
  magician: 1,
};
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function exact(v: unknown, expected: Record<string, unknown>): boolean {
  return (
    record(v) &&
    Object.keys(v).length === Object.keys(expected).length &&
    Object.entries(expected).every(([k, x]) => Object.hasOwn(v, k) && v[k] === x)
  );
}
/** Finite native twelve-player board; gun eligibility and night target mapping are independent. */
export function isMagicianPreset(input: unknown): boolean {
  if (isWolfSorcererPreset(input)) return true;
  if (isTricksterPreset(input)) return true;
  try {
    const c = copyEventData(input);
    if (!record(c)) return false;
    const required = [
      "boardSize",
      "enableSheriff",
      "magician",
      "hunter",
      "wolfKing",
      "roleSetups",
      "hooks",
      "selfDestruct",
      "seer",
      "witch",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
      "sheriff",
    ];
    const allowed = [...required, "winCondition", "winConditions"];
    if (
      !required.every((k) => Object.hasOwn(c, k)) ||
      Object.keys(c).some((k) => !allowed.includes(k)) ||
      c.boardSize !== 12 ||
      c.enableSheriff !== true
    )
      return false;
    const m = c.magician;
    if (
      !record(m) ||
      (m.firstNight !== 1 && m.firstNight !== 2) ||
      (m.deathShotTargetPolicy !== "original" && m.deathShotTargetPolicy !== "exchanged") ||
      !exact(m, {
        policy: "awa_magician_wolf_king_v1",
        firstNight: m.firstNight,
        deathShotTargetPolicy: m.deathShotTargetPolicy,
      })
    )
      return false;
    if (!Array.isArray(c.roleSetups) || c.roleSetups.length !== Object.keys(deck).length)
      return false;
    const seen = new Set<string>();
    for (const row of c.roleSetups) {
      if (
        !record(row) ||
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
      (Object.hasOwn(c, "winCondition") && c.winCondition !== goals[0])
    )
      return false;
    if (
      !exact(c.hunter, { deathActionPolicy: "awa_qualified_sources_v1" }) ||
      (!exact(c.wolfKing, { deathActionPolicy: "awa_qualified_sources_v1" }) &&
        !exact(c.wolfKing, { deathActionPolicy: "awa_day_deaths_v1" })) ||
      !exact(c.seer, {
        targetPolicy: "awa_alive_v1",
        actionPolicy: "awa_required_when_legal_v1",
      }) ||
      !exact(c.witch, {
        canSelfHeal: "disabled",
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
      }) ||
      !exact(c.voting, { exilePolicy: "awa_one_pk_v1" }) ||
      !exact(c.disclosure, { deathRevealPolicy: "awa_hidden_v1" }) ||
      !exact(c.lastWords, { policy: "awa_initial_wave_v1" }) ||
      !exact(c.sheriff, {
        electionPolicy: "awa_nomination_offstage_pk_v1",
        badgePolicy: "awa_holder_choice_v1",
        voteWeight: 1.5,
      }) ||
      !exact(c.tieBreaker, {
        sheriffVote: "no_elimination",
        wolfKillVote: "min_id",
        exileVote: "no_elimination",
      }) ||
      !exact(c.hooks, {
        onDaybreak: false,
        onPreElection: true,
        onPreVote: true,
        onPerSpeechGap: false,
      })
    )
      return false;
    if (
      !record(c.selfDestruct) ||
      Object.keys(c.selfDestruct).length !== 1 ||
      !Array.isArray(c.selfDestruct.enabledWindows)
    )
      return false;
    const w = c.selfDestruct.enabledWindows;
    return (
      w.length === 2 &&
      new Set(w).size === 2 &&
      w.every((x) => x === "on_pre_election" || x === "on_pre_vote")
    );
  } catch {
    return false;
  }
}
