/**
 * 负责定义审计任务的统一执行类型。输入为具体 AuditToolContext，输出为正式 AuditSubmission 或 null，
 * 生命周期沿实际 AgentTurnExecutor 的 runTurn／close 契约；类型别名不实现取消、期限或资源回收。
 * 这是 AI 审计执行接口，不是游戏玩家行动、库存、持久化或请求许可类型。
 */
import { AgentTurnExecutor } from "../runtime/agent_turn_executor";
import { AuditSubmission, AuditToolContext } from "./audit_tool_protocol";

export type AuditAgentExecutor = AgentTurnExecutor<AuditToolContext, AuditSubmission>;
