/**
 * 负责网易暗夜星辰原十／十二人板的有限生产支持。输入纯公开配置，输出精确牌组与AWA基础政策是否闭合；
 * 不允许其它高级角色／同名额外参数，不作为独立复盘oracle，也不授予任何运行权限。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
export function isAwakenedDarkStarsPreset(value: unknown): boolean {
  try {
    const c = copyEventData(value);
    if (!object(c) || ![10, 12].includes(c.boardSize as number)) return false;
    const size = c.boardSize as number,
      expected: Record<string, number> = {
        wolf: size === 10 ? 2 : 3,
        awakened_wolf_beauty: 1,
        villager: size === 10 ? 3 : 4,
        seer: 1,
        witch: 1,
        guard: 1,
        awakened_hunter: 1,
      };
    const allowed = new Set([
      "boardSize",
      "enableSheriff",
      "initialSheriffSeat",
      "winConditions",
      "winCondition",
      "hooks",
      "selfDestruct",
      "sheriff",
      "witch",
      "seer",
      "guard",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
      "roleSetups",
      "awakenedWolfBeauty",
      "awakenedHunter",
    ]);
    if (
      !Object.keys(c).every((k) => allowed.has(k)) ||
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
      object(c.awakenedWolfBeauty) &&
      c.awakenedWolfBeauty.policy === "awa_awakened_replacement_v1" &&
      Object.keys(c.awakenedWolfBeauty).length === 1 &&
      object(c.awakenedHunter) &&
      c.awakenedHunter.policy === "awa_directional_patrol_v1" &&
      Object.keys(c.awakenedHunter).length === 1 &&
      object(c.guard) &&
      c.guard.repeatPolicy === "awa_last_action_v1" &&
      Object.keys(c.guard).length === 1 &&
      object(c.witch) &&
      c.witch.canSelfHeal === "disabled" &&
      c.witch.knifeVisibility === "awa_with_heal_v1" &&
      c.witch.potionPolicy === "awa_one_native_v1" &&
      Object.keys(c.witch).length === 3 &&
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
