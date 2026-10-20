/**
 * 负责觉醒骑士／守卫原十二人板的有限生产支持，输入为公开纯配置，输出支持布尔值。
 * 精确声明双觉醒牌组、屠边/遗言与基础技能政策；不允许未裁决混搭，也不充当独立审计oracle。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function isAwakenedDayRolesPreset(value: unknown): boolean {
  try {
    const c = copyEventData(value),
      expected: Readonly<Record<string, number>> = {
        wolf: 3,
        awakened_wolf_beauty: 1,
        villager: 4,
        seer: 1,
        witch: 1,
        awakened_guard: 1,
        awakened_knight: 1,
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
        "witch",
        "tieBreaker",
        "voting",
        "disclosure",
        "lastWords",
        "roleSetups",
        "awakenedWolfBeauty",
        "awakenedGuard",
        "awakenedKnight",
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
      object(c.awakenedGuard) &&
      c.awakenedGuard.policy === "awa_awakened_guard_cycle_v1" &&
      Object.keys(c.awakenedGuard).length === 1 &&
      object(c.awakenedKnight) &&
      c.awakenedKnight.policy === "awa_awakened_duel_chain_v1" &&
      Object.keys(c.awakenedKnight).length === 1 &&
      object(c.awakenedWolfBeauty) &&
      c.awakenedWolfBeauty.policy === "awa_awakened_replacement_v1" &&
      Object.keys(c.awakenedWolfBeauty).length === 1 &&
      object(c.witch) &&
      c.witch.canSelfHeal === "disabled" &&
      c.witch.knifeVisibility === "awa_with_heal_v1" &&
      c.witch.potionPolicy === "awa_one_native_v1" &&
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
