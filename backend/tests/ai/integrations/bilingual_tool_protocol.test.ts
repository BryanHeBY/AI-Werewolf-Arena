import { expect, test } from "bun:test";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { gameToolProtocol } from "../../../src/ai/agents/game_tool_protocol";
import {
  auditToolProtocol,
  AuditToolTurnRegistry,
} from "../../../src/ai/audit/audit_tool_protocol";
import { AuditMcpControlServer } from "../../../src/ai/audit/audit_mcp_control";
import { AcpTurnRegistry } from "../../../src/ai/integrations/acp/acp_turn_registry";
import { WerewolfMcpControlServer } from "../../../src/ai/integrations/acp/werewolf_mcp_control";
import { taskLocale } from "../../../src/ai/integrations/acp/task_locale";
import { AiSdkClient } from "../../../src/ai/integrations/llm/ai_sdk_client";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { SdkAuditAgentExecutor } from "../../../src/ai/audit/sdk_audit_runner";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { Phase, type ActionRequest } from "../../../src/core";
import { errorMessage } from "@ai-werewolf-arena/game-text";
import type { Locale } from "@ai-werewolf-arena/game-text";

function withoutDescriptions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutDescriptions);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "description")
        .map(([key, child]) => [key, withoutDescriptions(child)]),
    );
  return value;
}

test("locale changes every protocol and nested parameter description without changing constraints", () => {
  for (const build of [gameToolProtocol, auditToolProtocol]) {
    const chinese = build("zh-CN");
    const english = build("en");
    expect(chinese.specs.map((spec) => spec.name)).toEqual(english.specs.map((spec) => spec.name));
    for (let index = 0; index < chinese.specs.length; index++) {
      expect(withoutDescriptions(chinese.specs[index].parameters)).toEqual(
        withoutDescriptions(english.specs[index].parameters),
      );
      expect(english.specs[index].description).not.toMatch(/[\u4e00-\u9fff]/);
      expect(JSON.stringify(english.specs[index].parameters)).not.toMatch(/[\u4e00-\u9fff]/);
    }
    expect(JSON.stringify(english.schema)).not.toMatch(/[\u4e00-\u9fff]/);
    expect(JSON.stringify(chinese.schema)).toMatch(/[\u4e00-\u9fff]/);
  }
  const nested = auditToolProtocol("en").specs.find(
    (spec) => spec.name === "submit_audit_findings",
  )!.parameters as any;
  expect(nested.properties.findings.items.properties.evidence.description).toContain(
    "authorized context",
  );
  expect(taskLocale({})).toBe("zh-CN");
  expect(taskLocale({ AWA_TASK_LOCALE: "en" })).toBe("en");
  expect(() => taskLocale({ AWA_TASK_LOCALE: "en-US" })).toThrow("acp_task_locale_invalid");
  expect(
    () =>
      new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig, { locale: "en-US" as Locale }).world),
  ).toThrow("game_locale_invalid");
  expect(() => new AuditToolTurnRegistry("en-US" as Locale)).toThrow("audit_task_locale_invalid");
});

const request: ActionRequest = {
  actorId: 1,
  phase: Phase.Day,
  allowedTools: ["speak"],
  context: {
    day: 1,
    stage: "day_speech",
    visible_events: [],
    turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
  },
};

test("real game/audit MCP subprocesses preserve simultaneous task locales and authorization", async () => {
  await Promise.all(
    (["zh-CN", "en"] as const).flatMap((locale) =>
      ["game", "audit"].map(async (kind) => {
        const gameRegistry = new AcpTurnRegistry(
          bootstrapGame(sixPlayerMvpConfig, { locale }).world,
        );
        const auditRegistry = new AuditToolTurnRegistry(locale);
        const control =
          kind === "game"
            ? new WerewolfMcpControlServer(gameRegistry)
            : new AuditMcpControlServer(auditRegistry);
        const entrypoint =
          kind === "game"
            ? "src/ai/integrations/acp/werewolf_mcp_server.ts"
            : "src/ai/audit/audit_mcp_server.ts";
        const config = await control.start(process.execPath, [
          path.resolve(process.cwd(), entrypoint),
        ]);
        const env = Object.fromEntries(config.env.map((entry) => [entry.name, entry.value]));
        expect(env.AWA_TASK_LOCALE).toBe(locale);
        expect(Object.keys(env).sort()).toEqual(
          kind === "game"
            ? ["AWA_TASK_LOCALE", "WEREWOLF_MCP_CONTROL_URL", "WEREWOLF_MCP_TOKEN"]
            : ["AUDIT_MCP_CONTROL_URL", "AUDIT_MCP_TOKEN", "AWA_TASK_LOCALE"],
        );
        const session = `${kind}-${locale}`;
        control.bindSession(session);
        const client = new Client({ name: session, version: "1.0.0" });
        try {
          await client.connect(
            new StdioClientTransport({ command: config.command, args: config.args, env }),
          );
          const listed = await client.listTools();
          const protocol = kind === "game" ? gameToolProtocol(locale) : auditToolProtocol(locale);
          for (const tool of listed.tools) {
            const spec = protocol.specs.find((spec) => spec.name === tool.name)!;
            expect(tool.description).toBe(spec.description);
            expect(spec.parameters).toEqual(tool.inputSchema);
            const body = JSON.stringify(tool);
            if (locale === "en") expect(body).not.toMatch(/[\u4e00-\u9fff]/);
          }
          const schema = await client.callTool({
            name: kind === "game" ? "get_game_schema" : "get_audit_schema",
            arguments: {},
          });
          expect(schema.structuredContent).toEqual(protocol.schema);
          if (kind === "game") {
            const turn = gameRegistry.openTurn(request, session);
            const malformed = await client.callTool({
              name: "submit_action",
              arguments: { turn_id: "", action: "speak", arguments: { text: "raw 中文" } },
            });
            expect(malformed.isError).toBe(true);
            expect(JSON.stringify(malformed.content)).toContain(
              locale === "en" ? "Tool arguments do not match this task" : "工具参数不符合本任务",
            );
            expect(
              (
                await client.callTool({
                  name: "submit_action",
                  arguments: { turn_id: "old", action: "speak", arguments: { text: "raw 中文" } },
                })
              ).structuredContent,
            ).toMatchObject({
              ok: false,
              error: "turn_id_mismatch",
              expected_turn_id: "t1",
              received_turn_id: "old",
            });
            expect(
              (
                await client.callTool({
                  name: "submit_action",
                  arguments: {
                    turn_id: turn.turnId,
                    action: "speak",
                    arguments: { text: "raw 中文" },
                  },
                })
              ).structuredContent,
            ).toEqual({ ok: true, accepted: true, applied: false, action: "speak" });
            expect(await turn.action).toEqual({ name: "speak", args: { text: "raw 中文" } });
          } else {
            const turn = auditRegistry.openTurn(
              {
                mode: "inspect",
                locale,
                taskName: "test",
                source: "synthetic",
                payload: { events: [{ seq: 7 }] },
              },
              session,
            );
            expect(
              (await client.callTool({ name: "get_audit_context", arguments: { turn_id: "old" } }))
                .structuredContent,
            ).toEqual({
              ok: false,
              error: "audit_turn_not_open_or_session_invalid",
              message: errorMessage(locale, "audit_turn_not_open_or_session_invalid"),
            });
            expect(
              (
                await client.callTool({
                  name: "submit_audit_findings",
                  arguments: {
                    turn_id: turn.turnId,
                    findings: [
                      { severity: "high", category: "state", message: "raw 中文", evidence: [999] },
                    ],
                  },
                })
              ).structuredContent,
            ).toEqual({
              ok: false,
              error: "audit_evidence_not_visible_in_current_context",
              message: errorMessage(locale, "audit_evidence_not_visible_in_current_context"),
            });
            expect(
              (
                await client.callTool({
                  name: "submit_audit_findings",
                  arguments: { turn_id: turn.turnId, findings: [] },
                })
              ).structuredContent,
            ).toEqual({ ok: true, accepted: true });
            expect(await turn.result).toMatchObject({ kind: "findings", findings: [] });
          }
        } finally {
          await client.close();
          gameRegistry.close();
          auditRegistry.closeTurn();
          await control.close({ force: true });
        }
      }),
    ),
  );
});

for (const locale of ["zh-CN", "en"] as const) {
  for (const kind of ["game", "audit"] as const)
    for (const mode of kind === "game" ? ["game"] : ["inspect", "summarize"]) {
      test(`${kind}/${mode} actual SDK HTTP request carries ${locale} descriptions and stable submission fields`, async () => {
        const requests: any[] = [];
        const server = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          async fetch(input) {
            requests.push(await input.json());
            return Response.json({
              id: "bilingual",
              object: "chat.completion",
              created: 1,
              model: "test",
              choices: [
                {
                  index: 0,
                  finish_reason: "tool_calls",
                  message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: "call",
                        type: "function",
                        function: {
                          name:
                            kind === "game"
                              ? "submit_action"
                              : mode === "summarize"
                                ? "submit_audit_summary"
                                : "submit_audit_findings",
                          arguments: JSON.stringify(
                            kind === "game"
                              ? {
                                  turn_id: "t1",
                                  action: "speak",
                                  arguments: { text: "Original 中文" },
                                }
                              : mode === "summarize"
                                ? { turn_id: "a1", markdown: "## Findings\n- none\nOriginal 中文" }
                                : { turn_id: "a1", findings: [] },
                          ),
                        },
                      },
                    ],
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            });
          },
        });
        const client = new AiSdkClient({
          apiKey: "test-only",
          baseURL: `${server.url.origin}/v1`,
          model: "test",
        });
        try {
          if (kind === "game") {
            const { world } = bootstrapGame(sixPlayerMvpConfig, { locale });
            const provider = new LlmActionProvider(world, client, {
              boardConfig: sixPlayerMvpConfig,
            });
            expect(await provider.getAction(request)).toEqual({
              name: "speak",
              args: { text: "Original 中文" },
            });
          } else {
            const executor = new SdkAuditAgentExecutor(client);
            expect(
              await executor.runTurn(
                {
                  mode: mode === "summarize" ? "summarize" : "inspect",
                  locale,
                  taskName: "audit",
                  source: "synthetic",
                  payload: {},
                },
                { timeoutMs: 1000 },
              ),
            ).toMatchObject(
              mode === "summarize"
                ? { kind: "summary", markdown: "## Findings\n- none\nOriginal 中文" }
                : { kind: "findings", findings: [] },
            );
            await executor.close();
          }
          expect(requests.length).toBe(1);
          {
            expect(requests[0].messages[0].content).toContain(
              locale === "en"
                ? kind === "game"
                  ? "Use English"
                  : "audit explanations in English"
                : kind === "game"
                  ? "你必须使用中文"
                  : "请使用中文提交审计说明",
            );
            if (locale === "en")
              expect(JSON.stringify(requests[0].messages)).not.toMatch(/[\u4e00-\u9fff]/);
          }
          const tools = requests[0].tools.map((tool: any) => tool.function);
          const protocol = kind === "game" ? gameToolProtocol(locale) : auditToolProtocol(locale);
          for (const spec of protocol.specs) {
            const tool = tools.find((tool: any) => tool.name === spec.name);
            expect(tool.description).toBe(spec.description);
            expect(tool.parameters).toMatchObject(spec.parameters);
          }
        } finally {
          server.stop(true);
        }
      });
    }
}
