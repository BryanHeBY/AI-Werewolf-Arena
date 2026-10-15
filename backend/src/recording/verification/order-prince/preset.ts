/**
 * 负责独立核验归档中的定序王子有限板子。输入为归档中已规范化的纯数据，输出为支持布尔值。
 * 先接受诡术师、蚀时狼妃组合；本族牌组仅固定人数、原生牌组、屠边与一次 PK，普通警长／钩子选项仍由其它层检查。
 * 本目录保留来自 Git 80ce15f 的独立判定及调用顺序，不导入生产规则集作验证 oracle。
 * 中立契约仅供应数据复制、事实与稳定政策标识；此处不是敌意对象的 Node 安全入口。
 * 通过数据 schema 不等于通过板子支持检查；本模块不授权行动或写入游戏状态。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { isTricksterPreset } from "../trickster/preset";
import { isTimeConsortPreset } from "../time-wolf-consort/preset";
const policy = "awa_order_prince_first_ballot_v1";
const deck: Readonly<Record<string, number>> = {
  wolf: 4,
  villager: 4,
  seer: 1,
  witch: 1,
  hunter: 1,
  order_prince: 1,
};
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
/** 固定原生牌组与 PK 契约；普通警长／钩子选项仍可配置，不在此扩为严格全字段判定。 */
export function isOrderPrincePreset(input: unknown): boolean {
  if (isTricksterPreset(input) || isTimeConsortPreset(input)) return true;
  try {
    const c = copyEventData(input);
    if (
      !object(c) ||
      c.boardSize !== 12 ||
      !Array.isArray(c.roleSetups) ||
      c.roleSetups.length !== 6
    )
      return false;
    // 每种牌只出现一次且数量匹配；行顺序不决定牌组支持，警长与钩子参数不在本分支收紧。
    const rows = c.roleSetups;
    if (
      rows.some(
        (row) =>
          !object(row) ||
          typeof row.role !== "string" ||
          !Object.hasOwn(deck, row.role) ||
          deck[row.role] !== row.count,
      ) ||
      new Set(rows.map((row) => (row as Record<string, unknown>).role)).size !== 6
    )
      return false;
    // 优先使用多目标字段；空数组仍会拒绝，旧单目标字段存在时也须与唯一屠边目标一致。
    const wins = c.winConditions ?? (c.winCondition ? [c.winCondition] : []);
    if (
      !Array.isArray(wins) ||
      wins.length !== 1 ||
      wins[0] !== "slaughter_side" ||
      (c.winCondition !== undefined && c.winCondition !== "slaughter_side")
    )
      return false;
    if (!object(c.voting) || c.voting.exilePolicy !== "awa_one_pk_v1") return false;
    return (
      c.orderPrince === undefined ||
      (object(c.orderPrince) &&
        Object.keys(c.orderPrince).length === 1 &&
        c.orderPrince.policy === policy)
    );
  } catch {
    return false;
  }
}
