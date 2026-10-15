/**
 * 负责查询既有有限板子的夜死是否先于白天结算。输入为只读板子参数；输出为原时点布尔值。
 * 这里只检查对应配置的真值，不推进阶段、结算伤害或安装角色状态。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type {} from "../../core/domain/board";
/** 这些有限板子在进入白天管线前提交夜死；这里只选择时点，不执行提交。 */
export function settlesNightBeforeDay(config: ReadonlyBoardConfig): boolean {
  return !!(config.pureWhite || config.evilKnight || config.demonHunter || config.ghostBride);
}
