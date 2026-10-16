/**
 * 负责定义 SDK、Pi 与 ACP 共用的提示构建结果、重试轨迹和轮次记录数据。
 * 提示／轮次编排器生产这些数据，记录器消费；此处只声明结构，不拥有会话、授权或领域提交。
 * 原始文案、工具参数与诊断保留输入含义；工具接受结果和最终游戏结算分别由各自所有者确认。
 */
import type { ErrorDiagnostic, ReplayPlayerDeltaMessage } from "@ai-werewolf-arena/replay-contract";
import type { AgentOutput } from "@ai-werewolf-arena/replay-contract";
import { ToolCall } from "../../domain";
import { ChatMessage } from "../../adapters/llm/transport";

/** 本次提示及记录定位信息；各传输自行维护历史，因此窗口指标不承诺相同实现。 */
export interface BuiltPlayerPrompt {
  /** 原提示消息数组可写；声明不复制、冻结或保证与任一传输内部历史共享同一对象。 */
  messages: ChatMessage[];
  /** 本轮已交给传输的输入增量；空数组表示尚未派发，缺席时沿用 userPrompt 的旧录制方式。 */
  requestMessages?: ChatMessage[];
  systemPrompt: string;
  userPrompt: string;
  boardInfoPrompt?: string;
  configPrompt?: string;
  isInitialRound: boolean;
  // 玩家可见序号游标；不是 God 事件下标，也不能暴露隐藏事件的数量。
  eventCursorBefore: number;
  eventCursorAfter: number;
  // 编排器记录本次选用的历史窗口边界；SDK 历史切片使用 [start, end)。
  contextWindowStart: number;
  contextWindowEnd: number;
  contextWindowTotal: number;
  // 本轮生成、供模型回传的关联标识；字符串本身不授予引擎行动权限。
  turnId: string;
  /** 仅轮次记录的附加文本，不在此形成完整协议档案、隐藏信息过滤或运行权限。 */
  auditMetadata?: string[];
}

/** 保留每次失败／未得到有效行动的原因、诊断和原始回应，供事后审查。 */
export interface PlayerRetryTraceEntry {
  /** 编排器提供的尝试编号；字段本身不限制循环预算或证明领域尚未付款。 */
  attempt: number;
  status: "request_error" | "no_valid_action";
  reason?: string;
  diagnostic?: ErrorDiagnostic;
  retryPrompt?: string;
  assistantText?: string;
}

/** 轮次决策记录；actionMode 与 finalAction 描述返回选择，不表示已付款或生效。 */
export interface PlayerRoundOutcome {
  /** 已归一的模型原文；记录器沿共同契约编码，展示开关不参与收集。 */
  agentOutputs?: readonly AgentOutput[];
  /** 传输原生块的显式记录；只保存本轮增量，不把完整会话历史复制成第二份状态。 */
  deltaMessages?: ReplayPlayerDeltaMessage[];
  actionMode: "tool_call" | "none";
  toolCalls: Array<{
    id?: string;
    name: string;
    args: Record<string, unknown>;
    // 工具层接受结果；不能据此推断领域提交、资源消耗或最终效果。
    accepted?: boolean;
    result?: Record<string, unknown> | string;
  }>;
  thinkingText?: string;
  finalAction?: ToolCall | null;
  /** 回退状态由调用方填入；used 为真也可没有 action，不据此推断回退成功或已生效。 */
  fallback?: {
    used: boolean;
    reason?: string;
    action?: { name: string; args: Record<string, unknown> };
  };
  retryTrace?: PlayerRetryTraceEntry[];
}
