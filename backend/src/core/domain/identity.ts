/**
 * 为现有领域与引擎消费者重导出 game-contract 拥有的机器身份。输出保持原枚举对象
 * 和类型，不声明第二套 ID；领域展示方法与 PromptRenderable 已退出，此处不渲染
 * 文案、执行角色规则或修改状态。
 */
export {
  Camp,
  Role,
  Phase,
  ActionWindow,
  KnightDuelWindow,
  StatusMark,
  WinCondition,
  PotionType,
  WitchSelfHealRule,
} from "@ai-werewolf-arena/game-contract";
export type { EntityId, TieBreakerStrategy } from "@ai-werewolf-arena/game-contract";
