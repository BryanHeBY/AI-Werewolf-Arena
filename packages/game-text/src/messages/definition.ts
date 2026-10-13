/**
 * 负责定义各文案所有者的 key／占位参数结构；机器 MessageKey 的唯一权威来自契约包。
 * 输入为模块拥有的 key 子集与参数名数组，输出为只读类型声明；[] 明确表示该文本无需插值。
 * 这是翻译 metadata，不是玩家参数或行动权限。运行时 MessageRef 拒绝由格式化器负责，
 * 类型 readonly 不会把原模块对象在运行时冻结。
 */
import type { MessageKey } from "@ai-werewolf-arena/game-contract";

export interface MessageDefinition {
  /** 家族归属标签，不是额外消息 ID 注册表；catalog 按 key 本身检查重复归属。 */
  readonly owner: string;
  /** 每个模块只声明 closed MessageKey 的子集；全体完整性由聚合器核对，每个 owned key 必有数组。 */
  readonly parameters: Readonly<Partial<Record<MessageKey, readonly string[]>>>;
}
