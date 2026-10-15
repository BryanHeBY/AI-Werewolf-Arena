/**
 * 负责禁言长老生产装配的有限板子支持判定，输入为纯公开板子数据，输出支持布尔值。
 * 仅允许原生十二人固定牌组和具名政策，拒绝事件包及高级机制混搭；判定不授夜窗或表达权限。
 * 独立归档verifier拥有另一套纯数据验算，不调用本生产谓词作为答案。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function isSilenceElderPreset(input: unknown): boolean {
  try {
    const c = copyEventData(input);
    const expected: Readonly<Record<string, number>> = {
      wolf: 4,
      villager: 4,
      seer: 1,
      witch: 1,
      hunter: 1,
      silence_elder: 1,
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
      "hunter",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
      "roleSetups",
      "silenceElder",
    ]);
    if (
      !object(c) ||
      !Object.keys(c).every((k) => allowed.has(k)) ||
      c.boardSize !== 12 ||
      !Array.isArray(c.roleSetups) ||
      c.roleSetups.length !== 6
    )
      return false;
    const rows = c.roleSetups;
    if (
      !rows.every(
        (r) =>
          object(r) &&
          typeof r.role === "string" &&
          Object.hasOwn(expected, r.role) &&
          expected[r.role] === r.count,
      ) ||
      new Set(rows.map((r) => (r as Record<string, unknown>).role)).size !== 6
    )
      return false;
    const config = c.silenceElder;
    return (
      JSON.stringify(c.winConditions ?? [c.winCondition]) === '["slaughter_side"]' &&
      (c.winCondition === undefined || c.winCondition === "slaughter_side") &&
      object(c.voting) &&
      c.voting.exilePolicy === "awa_one_pk_v1" &&
      object(config) &&
      config.policy === "awa_melbourne_gestures_v1" &&
      Object.keys(config).length === 1
    );
  } catch {
    return false;
  }
}
