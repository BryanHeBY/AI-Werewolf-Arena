import { describe, expect, test } from "bun:test";
import {
  AUDIT_TOOL_SPECS,
  AuditSubmission,
  AuditToolTurnRegistry,
} from "../../../src/ai/audit/audit_tool_protocol";
import { SdkAuditAgentExecutor } from "../../../src/ai/audit/audit_agent_executor";
import { AuditMcpControlServer } from "../../../src/ai/audit/audit_mcp_control";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "node:path";

describe("AuditToolTurnRegistry", () => {
  test("isolates sessions, enforces modes, and owns finding source", async () => {
    const registry = new AuditToolTurnRegistry();
    const turn = registry.openTurn({
      mode: "inspect",
      taskName: "agent_public",
      source: "public_timeline.json",
      payload: { events: [{ seq: 7 }] },
    }, "session-a");

    expect(registry.getContext("session-b", { turn_id: turn.turnId })).toEqual({
      ok: false,
      error: "audit_turn_not_open_or_session_invalid",
    });
    expect(registry.submitSummary("session-a", {
      turn_id: turn.turnId,
      markdown: "# invalid mode",
    })).toEqual({ ok: false, error: "audit_tool_not_allowed_in_this_mode" });
    expect(registry.submitFindings("session-a", {
      turn_id: turn.turnId,
      findings: [{
        severity: "high",
        category: "flow",
        message: "尝试引用其他上下文",
        evidence: [99],
      }],
      notes: [],
      missing_info: [],
    })).toEqual({ ok: false, error: "audit_evidence_not_visible_in_current_context" });
    expect(registry.submitFindings("session-a", {
      turn_id: turn.turnId,
      findings: [{
        severity: "high",
        category: "flow",
        message: "阶段顺序异常",
        evidence: [7],
        source: "forged.json",
      }],
      notes: [],
      missing_info: [],
    })).toEqual({ ok: true, accepted: true });

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
      async runToolLoop<T>(messages: Array<{ content: string }>, schemas: typeof AUDIT_TOOL_SPECS, callbacks: any) {
        expect(schemas.map((tool) => tool.name)).toEqual([
          "get_audit_schema",
          "get_audit_context",
          "submit_audit_findings",
          "submit_audit_summary",
        ]);
        expect(messages.some((message) => message.content.includes("private_payload_marker"))).toBe(false);
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
            findings: [{
              severity: "medium",
              category: "state",
              message: "状态不一致",
              evidence: [12],
            }],
            notes: [],
            missing_info: [],
          },
          rawArgs: "{}",
        });
        return { finalAction: (submitted.finalAction ?? null) as T | null };
      },
    };
    const executor = new SdkAuditAgentExecutor(client as any);
    const result = await executor.runTurn({
      mode: "inspect",
      taskName: "agent_logic",
      source: "logic_ops.json",
      payload: { private_payload_marker: true, ops: [{ seq: 12 }] },
    }, { timeoutMs: 1000 });

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

describe("Audit ACP MCP bridge", () => {
  test("exposes the same semantic audit contract and resolves a registry turn", async () => {
    const registry = new AuditToolTurnRegistry();
    const control = new AuditMcpControlServer(registry);
    const config = await control.start(process.execPath, []);
    const env = Object.fromEntries(config.env.map((entry) => [entry.name, entry.value]));
    control.bindSession("audit-session");
    const turn = registry.openTurn({
      mode: "inspect",
      taskName: "agent_reports",
      source: "debug_reports.json",
      payload: { reports: [{ seq: 3 }] },
    }, "audit-session");
    const client = new Client({ name: "audit-mcp-test", version: "1.0.0" });
    try {
      await client.connect(new StdioClientTransport({
        command: process.execPath,
        args: [path.resolve(process.cwd(), "src/ai/audit/audit_mcp_server.ts")],
        env: { ...process.env, ...env },
      }));
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual([
        "get_audit_schema",
        "get_audit_context",
        "submit_audit_findings",
        "submit_audit_summary",
      ]);
      await expect(client.callTool({
        name: "get_audit_context",
        arguments: { turn_id: turn.turnId },
      })).resolves.toMatchObject({
        structuredContent: { ok: true, context: { task_name: "agent_reports" } },
      });
      await expect(client.callTool({
        name: "submit_audit_findings",
        arguments: {
          turn_id: turn.turnId,
          findings: [{
            severity: "low",
            category: "logging",
            message: "日志重复",
            evidence: [3],
          }],
          notes: [],
          missing_info: [],
        },
      })).resolves.toMatchObject({ structuredContent: { ok: true, accepted: true } });
      await expect(turn.result).resolves.toMatchObject({
        kind: "findings",
        findings: [{ source: "debug_reports.json" }],
      });
    } finally {
      await client.close().catch(() => undefined);
      registry.closeTurn();
      await control.close();
    }
  });
});
