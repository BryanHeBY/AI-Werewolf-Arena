/**
 * 负责觉醒女巫原十二人板的有限生产支持，输入为公开纯配置，输出支持布尔值。
 * 精确声明双觉醒牌组、屠边/遗言与基础技能政策；不允许未裁决混搭，也不充当独立审计oracle。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function isAwakenedWitchPreset(value: unknown): boolean {
  try {
    const c = copyEventData(value),
      expected: Readonly<Record<string, number>> = {
        wolf: 3,
        awakened_wolf_king: 1,
        villager: 4,
        seer: 1,
        guard: 1,
        hunter: 1,
        awakened_witch: 1,
      },
      allowed = new Set([
        "boardSize",
        "enableSheriff",
        "initialSheriffSeat",
        "winConditions",
        "winCondition",
        "hooks",
        "selfDestruct",
        "sheriff",
        "seer",
        "guard",
        "hunter",
        "tieBreaker",
        "voting",
        "disclosure",
        "lastWords",
        "roleSetups",
        "awakenedWolfKing",
        "awakenedWitch",
      ]);
    if (
      !object(c) ||
      !Object.keys(c).every((k) => allowed.has(k)) ||
      c.boardSize !== 12 ||
      !Array.isArray(c.roleSetups) ||
      c.roleSetups.length !== 7 ||
      new Set(c.roleSetups.map((r) => (object(r) ? r.role : null))).size !== 7 ||
      !c.roleSetups.every(
        (r) =>
          object(r) &&
          typeof r.role === "string" &&
          Object.hasOwn(expected, r.role) &&
          r.count === expected[r.role],
      )
    )
      return false;
    return (
      JSON.stringify(c.winConditions ?? [c.winCondition]) === '["slaughter_side"]' &&
      (c.winCondition === undefined || c.winCondition === "slaughter_side") &&
      object(c.awakenedWitch) &&
      c.awakenedWitch.policy === "awa_awakened_witch_v1" &&
      Object.keys(c.awakenedWitch).length === 1 &&
      object(c.awakenedWolfKing) &&
      c.awakenedWolfKing.policy === "awa_awakened_wolf_king_v1" &&
      Object.keys(c.awakenedWolfKing).length === 1 &&
      object(c.guard) &&
      c.guard.repeatPolicy === "awa_last_action_v1" &&
      object(c.hunter) &&
      c.hunter.deathActionPolicy === "awa_qualified_sources_v1" &&
      object(c.seer) &&
      c.seer.targetPolicy === "awa_alive_v1" &&
      c.seer.actionPolicy === "awa_required_when_legal_v1" &&
      object(c.voting) &&
      c.voting.exilePolicy === "awa_one_pk_v1" &&
      object(c.disclosure) &&
      c.disclosure.deathRevealPolicy === "awa_hidden_v1" &&
      object(c.lastWords) &&
      c.lastWords.policy === "awa_initial_wave_v1"
    );
  } catch {
    return false;
  }
}
