/**
 * 负责觉醒狼王来源板的有限支持判定。输入为公开板子数据，输出十／十二人两份精确牌组是否受支持。
 * 拒绝高级混搭、事件包、额外角色及未交付的觉醒女巫板；不创建资源、查询现场生命或计算归档 oracle。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
export function isAwakenedWolfKingPreset(value: unknown): boolean {
  try {
    const c = copyEventData(value);
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
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
      "roleSetups",
      "awakenedWolfKing",
      "dreamer",
    ]);
    if (
      !object(c) ||
      !Object.keys(c).every((key) => allowed.has(key)) ||
      ![10, 12].includes(c.boardSize as number) ||
      !Array.isArray(c.roleSetups)
    )
      return false;
    const expected: Record<string, number> = {
      wolf: c.boardSize === 10 ? 2 : 3,
      awakened_wolf_king: 1,
      villager: 4,
      seer: 1,
      witch: 1,
      miracle_merchant: 1,
      ...(c.boardSize === 12 ? { dreamer: 1 } : {}),
    };
    if (
      c.roleSetups.length !== Object.keys(expected).length ||
      !c.roleSetups.every(
        (row) =>
          object(row) &&
          typeof row.role === "string" &&
          Object.hasOwn(expected, row.role) &&
          row.count === expected[row.role],
      ) ||
      new Set(c.roleSetups.map((row) => (row as Record<string, unknown>).role)).size !==
        c.roleSetups.length
    )
      return false;
    return (
      JSON.stringify(c.winConditions ?? [c.winCondition]) === '["slaughter_side"]' &&
      (c.winCondition === undefined || c.winCondition === "slaughter_side") &&
      object(c.awakenedWolfKing) &&
      c.awakenedWolfKing.policy === "awa_awakened_wolf_king_v1" &&
      object(c.witch) &&
      c.witch.canSelfHeal === (c.boardSize === 10 ? "first_night_only" : "disabled") &&
      (c.boardSize === 10
        ? c.dreamer === undefined
        : object(c.dreamer) && c.dreamer.protectionPolicy === "awa_night_damage_v1") &&
      object(c.voting) &&
      c.voting.exilePolicy === "awa_one_pk_v1"
    );
  } catch {
    return false;
  }
}
