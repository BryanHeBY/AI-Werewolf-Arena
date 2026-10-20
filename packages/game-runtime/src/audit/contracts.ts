/**
 * 负责审计任务、证据数据与中立结果说明的类型契约。输入为录制证据和审计要求，输出描述请求／结果并单独保留模型原文。
 * 审计子系统拥有这些证据与任务结构，持久化会话仍归录制所有者；声明不运行审计、不选择游戏行动或渲染翻译。
 */
import type { MessageKey, MessageRef } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-contract";
import type {
  ReplayDebugReport,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "../recording/contracts";

export interface BuildDebugSummaryInput {
  /** 审查语言；来源原文保持。 */
  locale?: Locale;
  /** 最终摘要语言，独立于审计是否可用。 */
  displayLocale?: Locale;
  manifest: ReplayManifest;
  reports: ReplayDebugReport[];
  publicEvents?: ReplayPublicEvent[];
  logicOps?: ReplayLogicOp[];
  playerViews?: ReplayPlayerView[];
  sessionDir?: string;
}

export interface SummaryObservation {
  code: "event_counts" | "process_counts" | "actions" | "invalid_day" | "request_mismatch";
  title: MessageKey;
  detail: MessageRef;
  evidence?: number[];
}

export interface DeterministicFinding {
  code: "first_day_blast" | "guard_mention" | "potion_claim" | "invalid_day" | "request_mismatch";
  severity: ReplayDebugReport["severity"];
  category: ReplayDebugReport["category"];
  day: number;
  phase: string;
  actorId: number;
  message: MessageRef;
  evidence: number[];
}
