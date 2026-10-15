/**
 * Unit tests own audit turn/session/mode/evidence authorization and synthetic SDK
 * tool-loop semantics. Literal payloads and callback submissions check exact source
 * attribution, context visibility and public tool names; the original describe prefixes
 * and expected messages remain the oracle. No MCP listener or subprocess is started.
 */
import { describe, expect, test } from "bun:test";
import {
  AUDIT_TOOL_SPECS,
  AuditSubmission,
  AuditToolTurnRegistry,
} from "../../../../src/audit/agents/audit-tool-protocol";
import { SdkAuditAgentExecutor } from "../../../../src/audit/agents/sdk-audit-runner";

describe("AuditToolTurnRegistry", () => {
  test("isolates sessions, enforces modes, and owns finding source", async () => {
    const registry = new AuditToolTurnRegistry();
    const turn = registry.openTurn(
      {
        mode: "inspect",
        taskName: "agent_public",
        source: "public_timeline.json",
        payload: { events: [{ seq: 7 }] },
      },
      "session-a",
    );

    expect(registry.getContext("session-b", { turn_id: turn.turnId })).toEqual({
      ok: false,
      error: "audit_turn_not_open_or_session_invalid",
      message: "审计回合未开放或会话不匹配；请使用本任务当前turn_id。",
    });
    expect(
      registry.submitSummary("session-a", {
        turn_id: turn.turnId,
        markdown: "# invalid mode",
      }),
    ).toEqual({
      ok: false,
      error: "audit_tool_not_allowed_in_this_mode",
      message: "该工具不适用于当前审计模式；请使用当前模式对应的submit工具。",
    });
    expect(
      registry.submitFindings("session-a", {
        turn_id: turn.turnId,
        findings: [
          {
            severity: "high",
            category: "flow",
            message: "尝试引用其他上下文",
            evidence: [99],
          },
        ],
        notes: [],
        missing_info: [],
      }),
    ).toEqual({
      ok: false,
      error: "audit_evidence_not_visible_in_current_context",
      message: "证据序号不在本任务授权上下文中；请仅引用当前上下文中可见的证据。",
    });
    expect(
      registry.submitFindings("session-a", {
        turn_id: turn.turnId,
        findings: [
          {
            severity: "high",
            category: "flow",
            message: "阶段顺序异常",
            evidence: [7],
            source: "forged.json",
          },
        ],
        notes: [],
        missing_info: [],
      }),
    ).toEqual({ ok: true, accepted: true });

    await expect(turn.result).resolves.toMatchObject({
      kind: "findings",
      agent: "agent_public",
      findings: [{ source: "public_timeline.json", evidence: [7] }],
    });
  });
});

describe("SdkAuditAgentExecutor", () => {
  test("uses the same semantic tools without embedding audit payload in prompts", async () => {
    let visibleContext: Record<string, unknown> | undefined;
    const client = {
      async runToolLoop<T>(
        messages: Array<{ content: string }>,
        schemas: typeof AUDIT_TOOL_SPECS,
        callbacks: any,
      ) {
        expect(schemas.map((tool) => tool.name)).toEqual([
          "get_audit_schema",
          "get_audit_context",
          "submit_audit_findings",
          "submit_audit_summary",
        ]);
        expect(messages.some((message) => message.content.includes("private_payload_marker"))).toBe(
          false,
        );
        const turnId = messages.at(-1)?.content.match(/ID：([^\n]+)/)?.[1];
        expect(turnId).toBeTruthy();
        const contextCall = await callbacks.onToolCall({
          id: "context",
          name: "get_audit_context",
          args: { turn_id: turnId },
          rawArgs: "{}",
        });
        visibleContext = contextCall.toolResult.context;
        const submitted = await callbacks.onToolCall({
          id: "submit",
          name: "submit_audit_findings",
          args: {
            turn_id: turnId,
            findings: [
              {
                severity: "medium",
                category: "state",
                message: "状态不一致",
                evidence: [12],
              },
            ],
            notes: [],
            missing_info: [],
          },
          rawArgs: "{}",
        });
        return { finalAction: (submitted.finalAction ?? null) as T | null };
      },
    };
    const executor = new SdkAuditAgentExecutor(client as any);
    const result = await executor.runTurn(
      {
        mode: "inspect",
        taskName: "agent_logic",
        source: "logic_ops.json",
        payload: { private_payload_marker: true, ops: [{ seq: 12 }] },
      },
      { timeoutMs: 1000 },
    );

    expect(visibleContext).toMatchObject({
      mode: "inspect",
      task_name: "agent_logic",
      payload: { private_payload_marker: true },
    });
    expect(result as AuditSubmission).toMatchObject({
      kind: "findings",
      findings: [{ source: "logic_ops.json", evidence: [12] }],
    });
  });
});
