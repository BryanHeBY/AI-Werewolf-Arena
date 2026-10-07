import { toolFailure } from "@ai-werewolf-arena/game-text";
import { z } from "zod";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { isLocale } from "@ai-werewolf-arena/game-catalog";
import { ToolSchema } from "../integrations/llm/transport";

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
  locale?: Locale;
  mode: "inspect" | "summarize";
  taskName: string;
  source: string;
  payload: Record<string, unknown>;
}

export function auditToolProtocol(locale: Locale = "zh-CN") {
  const schemaError = text(locale, "error.schema_input");
  const turnId = z.string({ error: schemaError }).min(1, { error: schemaError }).describe(text(locale, "schema.turn_id"));
  const findingInput = z.object({
    severity: z.enum(["low", "medium", "high", "critical"], { error: schemaError }).describe(text(locale, "schema.severity")),
    category: z.enum(["flow", "rule", "state", "logging", "other"], { error: schemaError }).describe(text(locale, "schema.category")),
    message: z.string({ error: schemaError }).min(1, { error: schemaError }).max(300, { error: schemaError }).describe(text(locale, "schema.audit.finding_message")),
    evidence: z.array(z.number({ error: schemaError }).int({ error: schemaError }).positive({ error: schemaError }), { error: schemaError }).max(20, { error: schemaError }).describe(text(locale, "schema.audit.evidence")),
  }, { error: schemaError });
  const inputs = {
    get_audit_schema: z.object({}, { error: schemaError }),
    get_audit_context: z.object({ turn_id: turnId }, { error: schemaError }),
    submit_audit_findings: z.object({
      turn_id: turnId,
      findings: z.array(findingInput, { error: schemaError }).max(5, { error: schemaError }).describe(text(locale, "schema.audit.finding_list")),
      notes: z.array(z.string({ error: schemaError }).min(1, { error: schemaError }).max(240, { error: schemaError }).describe(text(locale, "schema.audit.note_item")), { error: schemaError }).max(3, { error: schemaError }).default([]).describe(text(locale, "schema.audit.notes")),
      missing_info: z.array(z.string({ error: schemaError }).min(1, { error: schemaError }).max(240, { error: schemaError }).describe(text(locale, "schema.audit.missing_item")), { error: schemaError }).max(3, { error: schemaError }).default([]).describe(text(locale, "schema.audit.missing_info")),
    }, { error: schemaError }),
    submit_audit_summary: z.object({ turn_id: turnId, markdown: z.string({ error: schemaError }).min(1, { error: schemaError }).max(12_000, { error: schemaError }).describe(text(locale, "schema.audit.markdown")) }, { error: schemaError }),
  };
  const descriptions = {
    get_audit_schema: text(locale, "schema.audit.query"),
    get_audit_context: text(locale, "schema.audit.context"),
    submit_audit_findings: text(locale, "schema.audit.findings"),
    submit_audit_summary: text(locale, "schema.audit.summary"),
  };
  const schema = { protocol_version: "1", tools: {
    get_audit_schema: text(locale, "schema.audit.static_query"),
    get_audit_context: text(locale, "schema.audit.static_context"),
    submit_audit_findings: text(locale, "schema.audit.static_findings"),
    submit_audit_summary: text(locale, "schema.audit.static_summary"),
  } };
  const specs: ToolSchema[] = (Object.keys(inputs) as Array<keyof typeof inputs>).map(name => ({ name,
    description: descriptions[name], parameters: z.toJSONSchema(inputs[name], { io: "input", target: "draft-7" }) as Record<string, unknown>,
  }));
  return { inputs, descriptions, schema, specs };
}

const defaultProtocol = auditToolProtocol();
export const getAuditContextInput = defaultProtocol.inputs.get_audit_context;
export const getAuditSchemaInput = defaultProtocol.inputs.get_audit_schema;
export const submitAuditFindingsInput = defaultProtocol.inputs.submit_audit_findings;
export const submitAuditSummaryInput = defaultProtocol.inputs.submit_audit_summary;
export const AUDIT_TOOL_SCHEMA = defaultProtocol.schema;
export const AUDIT_TOOL_SPECS = defaultProtocol.specs;

export type AuditToolResult =
  | { ok: true; accepted?: true; context?: Record<string, unknown> }
  | { ok: false; error: string; message: string };

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

  constructor(readonly locale: Locale = "zh-CN") { if (!isLocale(locale)) throw new Error("audit_task_locale_invalid"); }

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
    return auditToolProtocol(this.locale).schema;
  }

  getContext(sessionId: string, input: unknown): AuditToolResult {
    const parsed = getAuditContextInput.safeParse(input);
    if (!parsed.success) return toolFailure(this.locale, "invalid_get_audit_context_arguments");
    const pending = this.getPending(sessionId, parsed.data.turn_id);
    if (!pending) return toolFailure(this.locale, "audit_turn_not_open_or_session_invalid");
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
    if (!parsed.success) return toolFailure(this.locale, "invalid_submit_audit_findings_arguments");
    const pending = this.getPending(sessionId, parsed.data.turn_id);
    if (!pending) return toolFailure(this.locale, "audit_turn_not_open_or_session_invalid");
    if (pending.context.mode !== "inspect") {
      return toolFailure(this.locale, "audit_tool_not_allowed_in_this_mode");
    }
    const visibleEvidence = collectVisibleEvidenceSeqs(pending.context.payload);
    if (
      parsed.data.findings.some((finding) =>
        finding.evidence.some((seq) => !visibleEvidence.has(seq)))
    ) {
      return toolFailure(this.locale, "audit_evidence_not_visible_in_current_context");
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
    if (!parsed.success) return toolFailure(this.locale, "invalid_submit_audit_summary_arguments");
    const pending = this.getPending(sessionId, parsed.data.turn_id);
    if (!pending) return toolFailure(this.locale, "audit_turn_not_open_or_session_invalid");
    if (pending.context.mode !== "summarize") {
      return toolFailure(this.locale, "audit_tool_not_allowed_in_this_mode");
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
