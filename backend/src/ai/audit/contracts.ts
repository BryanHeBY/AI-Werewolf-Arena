import { AgentTurnExecutor } from "../runtime/agent_turn_executor";
import { AuditSubmission, AuditToolContext } from "./audit_tool_protocol";

export type AuditAgentExecutor = AgentTurnExecutor<AuditToolContext, AuditSubmission>;
