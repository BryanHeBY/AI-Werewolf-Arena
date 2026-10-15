/**
 * 负责从明确的引擎要求构造公共回合约束数据。输入为必须行动标识、允许工具、可选摘要和动作上限；
 * 输出保留原默认值、可选字段及字符串／中立消息引用的区别，不在这里渲染文案。
 * 这些字段描述请求要求，不是已经提交的行动、真实库存、期限或运行凭据；实际准入与完成仍归原所有者。
 * 本模块不读 World、不持玩家状态或授权，不增加参数 schema／有限数校验或修复既有非法输入。
 */
import type { MessageRef } from "@ai-werewolf-arena/game-contract";
import { ToolName, TurnConstraints } from "../../domain/model";

/**
 * 构造统一的 turn_constraints 上下文字段。
 * 默认按“单主动作”生成：必须行动的 min 为 1，可选窗口为 0，默认上限为 1。
 * 只有必须行动才复制 required_any_tools；可选窗口输出空数组，不据工具名字新增角色资格。
 * max 仍执行原取整／Math.max，不额外保证有限数；消费端另按原契约解析和检查实际动作。
 */
export function buildTurnConstraintContext(input: {
  /** 原布尔字段在 min 和 required_any_tools 处分别读取；不把两次 getter 合成快照。 */
  requiresAction: boolean;
  /** 必须行动时另复制此数组；不是对实际资源或具体机制当前性的授权。 */
  allowedTools: ToolName[];
  /** 非空字符串保持原字段；真值消息引用在原分支克隆，二者不合并成已渲染文案。 */
  summary?: string | MessageRef;
  /** 仅按原 nullish 默认及取整处理；未在此加入数值验证或新的拒绝政策。 */
  maxValidActions?: number;
}): TurnConstraints {
  const min = input.requiresAction ? 1 : 0;
  // max → 必须工具 → 摘要按原顺序求值；数组展开或消息 clone 失败仍传播，不能返回部分约束。
  return {
    min_valid_actions: min,
    max_valid_actions: Math.max(min, Math.floor(input.maxValidActions ?? 1)),
    required_any_tools: input.requiresAction ? [...input.allowedTools] : [],
    ...(typeof input.summary === "string"
      ? input.summary
        ? { summary: input.summary }
        : {}
      : input.summary
        ? { summary_message: structuredClone(input.summary) }
        : {}),
  };
}
