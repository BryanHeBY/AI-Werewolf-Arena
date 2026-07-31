import { z } from "zod";
import { ToolSchema } from "../integrations/llm/ai_sdk_client";

export type AuditSeverity = "low" | "medium" | "high" | "critical";
export type AuditCategory = "flow" | "rule" | "state" | "logging" | "other";

export interface AuditFinding {
  severity: AuditSeverity;
  category: AuditCategory;
  message: string;
  evidence: number[];
  source: string;
}

export interface AuditInspectionResult {
  kind: "findings";
  agent: string;
  findings: AuditFinding[];
  notes: string[];
  missing_info: string[];
}

export interface AuditSummaryResult {
  kind: "summary";
  markdown: string;
}

export type AuditSubmission = AuditInspectionResult | AuditSummaryResult;

export interface AuditToolContext {
  mode: "inspect" | "summarize";
  taskName: string;
  source: string;
  payload: Record<string, unknown>;
}

export const getAuditContextInput = z.object({
  turn_id: z.string().min(1),
});

export const getAuditSchemaInput = z.object({});

const findingInput = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum(["flow", "rule", "state", "logging", "other"]),
  message: z.string().min(1).max(300),
  evidence: z.array(z.number().int().positive()).max(20),
});

export const submitAuditFindingsInput = z.object({
  turn_id: z.string().min(1),
  findings: z.array(findingInput).max(5),
  notes: z.array(z.string().min(1).max(240)).max(3).default([]),
  missing_info: z.array(z.string().min(1).max(240)).max(3).default([]),
});

export const submitAuditSummaryInput = z.object({
  turn_id: z.string().min(1),
  markdown: z.string().min(1).max(12_000),
});

export const AUDIT_TOOL_SCHEMA = {
  protocol_version: "1",
  tools: {
    get_audit_schema: "{}；查询固定审计工具协议，不返回任何复盘内容。",
    get_audit_context: "{ turn_id }；读取当前任务唯一可见的结构化审计上下文。",
    submit_audit_findings:
      "{ turn_id, findings, notes, missing_info }；inspect 模式提交结构化发现。",
    submit_audit_summary: "{ turn_id, markdown }；summarize 模式提交最终 Markdown。",
  },
} as const;

function jsonParameters(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema) as Record<string, unknown>;
}

/** SDK function tools 与 ACP MCP server 共用这些名字、说明和参数约束。 */
export const AUDIT_TOOL_SPECS: ToolSchema[] = [
  {
    name: "get_audit_schema",
    description: "查询固定审计工具协议，不返回任何复盘内容。",
    parameters: jsonParameters(getAuditSchemaInput),
  },
  {
    name: "get_audit_context",
    description: "读取当前审计 turn 被授权看到的结构化上下文，不返回其他玩家或任务的数据。",
    parameters: jsonParameters(getAuditContextInput),
  },
  {
    name: "submit_audit_findings",
    description: "提交本审计任务的结构化 findings；只能在 inspect 模式调用一次。",
    parameters: jsonParameters(submitAuditFindingsInput),
  },
  {
    name: "submit_audit_summary",
    description: "提交最终 Markdown 审计报告；只能在 summarize 模式调用一次。",
    parameters: jsonParameters(submitAuditSummaryInput),
  },
];

export type AuditToolResult =
  | { ok: true; accepted?: true; context?: Record<string, unknown> }
  | { ok: false; error: string };

interface PendingAuditTurn {
  sessionId: string;
  turnId: string;
  context: AuditToolContext;
  result: Promise<AuditSubmission | null>;
  resolve: (value: AuditSubmission | null) => void;
}

/** SDK 与 ACP 共用的单回合上下文隔离、Schema 校验和提交状态机。 */
export class AuditToolTurnRegistry {
  private pending: PendingAuditTurn | null = null;
  private nextTurn = 0;

  openTurn(context: AuditToolContext, sessionId: string): {
    turnId: string;
    result: Promise<AuditSubmission | null>;
  } {
    if (this.pending) throw new Error("audit_turn_already_open");
    const turnId = `a${++this.nextTurn}`;
    let resolve!: (value: AuditSubmission | null) => void;
    const result = new Promise<AuditSubmission | null>((done) => {
      resolve = done;
    });
    this.pending = { sessionId, turnId, context, result, resolve };
    return { turnId, result };
  }

  getSchema(): typeof AUDIT_TOOL_SCHEMA {
    return AUDIT_TOOL_SCHEMA;
  }

  getContext(sessionId: string, input: unknown): AuditToolResult {
    const parsed = getAuditContextInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_get_audit_context_arguments" };
    const pending = this.getPending(sessionId, parsed.data.turn_id);
    if (!pending) return { ok: false, error: "audit_turn_not_open_or_session_invalid" };
    return {
      ok: true,
      context: {
        mode: pending.context.mode,
        task_name: pending.context.taskName,
        source: pending.context.source,
        payload: pending.context.payload,
      },
    };
  }

  submitFindings(sessionId: string, input: unknown): AuditToolResult {
    const parsed = submitAuditFindingsInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_submit_audit_findings_arguments" };
    const pending = this.getPending(sessionId, parsed.data.turn_id);
    if (!pending) return { ok: false, error: "audit_turn_not_open_or_session_invalid" };
    if (pending.context.mode !== "inspect") {
      return { ok: false, error: "audit_tool_not_allowed_in_this_mode" };
    }
    const visibleEvidence = collectVisibleEvidenceSeqs(pending.context.payload);
    if (
      parsed.data.findings.some((finding) =>
        finding.evidence.some((seq) => !visibleEvidence.has(seq)))
    ) {
      return { ok: false, error: "audit_evidence_not_visible_in_current_context" };
    }
    this.pending = null;
    pending.resolve({
      kind: "findings",
      agent: pending.context.taskName,
      findings: parsed.data.findings.map((item) => ({
        ...item,
        source: pending.context.source,
      })),
      notes: parsed.data.notes,
      missing_info: parsed.data.missing_info,
    });
    return { ok: true, accepted: true };
  }

  submitSummary(sessionId: string, input: unknown): AuditToolResult {
    const parsed = submitAuditSummaryInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_submit_audit_summary_arguments" };
    const pending = this.getPending(sessionId, parsed.data.turn_id);
    if (!pending) return { ok: false, error: "audit_turn_not_open_or_session_invalid" };
    if (pending.context.mode !== "summarize") {
      return { ok: false, error: "audit_tool_not_allowed_in_this_mode" };
    }
    this.pending = null;
    pending.resolve({ kind: "summary", markdown: parsed.data.markdown.trim() });
    return { ok: true, accepted: true };
  }

  closeTurn(): void {
    const pending = this.pending;
    this.pending = null;
    pending?.resolve(null);
  }

  private getPending(sessionId: string, turnId: string): PendingAuditTurn | null {
    return this.pending?.sessionId === sessionId && this.pending.turnId === turnId
      ? this.pending
      : null;
  }
}

function collectVisibleEvidenceSeqs(value: unknown): Set<number> {
  const out = new Set<number>();
  const visit = (current: unknown, key?: string): void => {
    if (typeof current === "number" && Number.isInteger(current) && current > 0) {
      if (key === "seq" || key === "evidence" || key === "evidence_event_seq") out.add(current);
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current) visit(item, key);
      return;
    }
    if (!current || typeof current !== "object") return;
    for (const [childKey, child] of Object.entries(current as Record<string, unknown>)) {
      visit(child, childKey);
    }
  };
  visit(value);
  return out;
}
