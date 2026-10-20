/**
 * 集成测试以真实 AI SDK／Pi SDK 的 localhost 服务和实际 MCP sidecar 验证确认往返。
 * 预期来自手写协议回执、模型下一次收到的工具消息、生命与领域事件；不调用外部模型或真实凭据。
 * 本测试只选择候选，真实死亡提交另由机制场景验证；finally 关闭会话、子进程和监听。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { AcpTurnRegistry } from "../../../../src/adapters/acp/acp-turn-registry";
import { WerewolfMcpControlServer } from "../../../../src/adapters/acp/werewolf-mcp-control";
import { AiSdkClient } from "../../../../src/adapters/llm/ai-sdk-client";
import { PiRuntime } from "../../../../src/adapters/pi";
import { LlmActionProvider } from "../../../../src/agents/llm/llm-action-provider";
import { PiActionProvider } from "../../../../src/agents/pi/pi-action-provider";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { ActionWindow, COMPONENT, Phase, Role, type ActionRequest } from "../../../../src/domain";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import type { SessionRecordManager } from "../../../../src/recording/session/recorder";
import type { ReplayRecordPlayerRoundInput } from "../../../../src/recording/contracts";
import type { AgentOutputEvent } from "@ai-werewolf-arena/replay-contract";

const action = { name: "self_destruct" as const, args: { reason: "占位", confirm: true } };
function fixture(locale: "zh-CN" | "en") {
  const game = bootstrapGame(sixPlayerMvpConfig, {
    locale,
    fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager],
  });
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Voting,
    actionWindow: ActionWindow.OnPreVote,
    allowedTools: ["self_destruct"],
    context: {
      day: 1,
      stage: ActionWindow.OnPreVote,
      visible_events: [],
      turn_constraints: { min_valid_actions: 0, max_valid_actions: 1 },
    },
  };
  return { ...game, request };
}
function modelResponse(args?: Record<string, unknown>, stream = false) {
  const message = args
    ? {
        tool_calls: [
          {
            index: 0,
            id: crypto.randomUUID(),
            type: "function",
            function: { name: "submit_action", arguments: JSON.stringify(args) },
          },
        ],
      }
    : { content: "不自爆，结束回合。" };
  const choice = { index: 0, finish_reason: args ? "tool_calls" : "stop" };
  if (!stream)
    return Response.json({
      id: "synthetic-confirmation",
      object: "chat.completion",
      created: 1,
      model: "synthetic",
      choices: [{ ...choice, message: { role: "assistant", ...message } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  const chunk = (delta: unknown, finish_reason: string | null) => ({
    id: "synthetic-confirmation",
    object: "chat.completion.chunk",
    created: 1,
    model: "synthetic",
    choices: [{ index: 0, delta, finish_reason }],
  });
  return new Response(
    [chunk(message, null), chunk({}, choice.finish_reason)]
      .map((c) => `data: ${JSON.stringify(c)}\n\n`)
      .join("") + "data: [DONE]\n\n",
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

for (const transport of ["llm", "pi"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const confirm of [false, true])
      test(`${transport}/${locale}: 真实模型传输收到警示，${confirm ? "显式确认才能选中" : "结束即跳过且无自动重试"}`, async () => {
        const game = fixture(locale),
          events: AgentOutputEvent[] = [],
          records: ReplayRecordPlayerRoundInput[] = [];
        const receipts: any[] = [];
        let requests = 0,
          observedTurn = "";
        const server = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          async fetch(req) {
            const body = (await req.json()) as any;
            requests++;
            expect(body.tools.map((t: any) => t.function.name)).toEqual([
              "get_game_schema",
              "submit_action",
              "report_bug",
            ]);
            const schema = body.tools.find((t: any) => t.function.name === "submit_action").function
              .parameters;
            expect(schema.properties.confirmation_id).toBeDefined();
            expect(schema.required).not.toContain("confirmation_id");
            if (requests === 1) {
              const prompt = body.messages.filter((m: any) => m.role === "user").at(-1).content;
              observedTurn =
                /(?:turn_id 必须为 |turn_id must be |Current turn ID: |当前回合 ID：)([pt]\d+)/.exec(
                  prompt,
                )?.[1] ?? (transport === "pi" ? "p1" : "t1");
              return modelResponse(
                { turn_id: observedTurn, action: action.name, arguments: action.args },
                !!body.stream,
              );
            }
            const receipt = JSON.parse(
              body.messages.filter((m: any) => m.role === "tool").at(-1).content,
            );
            receipts.push(receipt);
            expect(receipt).toMatchObject({
              ok: true,
              status: "confirmation_required",
              accepted: false,
              applied: false,
              action: "self_destruct",
              arguments: action.args,
            });
            expect(receipt.warning).toContain(locale === "en" ? "not a placeholder" : "不是占位");
            expect(game.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
            expect(requests).toBe(2);
            return modelResponse(
              confirm
                ? {
                    turn_id: observedTurn,
                    action: action.name,
                    arguments: action.args,
                    confirmation_id: receipt.confirmation_id,
                  }
                : undefined,
              !!body.stream,
            );
          },
        });
        let runtime: PiRuntime | undefined;
        let provider: LlmActionProvider | PiActionProvider | undefined;
        try {
          if (transport === "pi")
            runtime = await PiRuntime.create({
              models: {
                providers: {
                  "awa-confirm": {
                    baseUrl: `${server.url.origin}/v1`,
                    api: "openai-completions",
                    models: [{ id: "synthetic", compat: { supportsReasoningEffort: false } }],
                  },
                },
              },
              auth: { "awa-confirm": { type: "api_key", key: "synthetic-only" } },
            });
          provider =
            transport === "llm"
              ? new LlmActionProvider(
                  game.world,
                  new AiSdkClient({
                    baseURL: `${server.url.origin}/v1`,
                    model: "synthetic",
                    apiKey: "synthetic-only",
                  }),
                  {
                    boardConfig: sixPlayerMvpConfig,
                    printThinking: false,
                    llmTimeoutMs: 5000,
                    outputSink: (e) => events.push(e),
                  },
                )
              : new PiActionProvider(game.world, {
                  runtime: runtime!,
                  settingsResolver: () => ({
                    defaultProvider: "awa-confirm",
                    defaultModel: "synthetic",
                    retry: { enabled: false },
                  }),
                  boardConfig: sixPlayerMvpConfig,
                  turnTimeoutMs: 5000,
                  outputSink: (e) => events.push(e),
                });
          const recorder = {
            recordPlayerRound: (row: ReplayRecordPlayerRoundInput) => records.push(row),
            recordLogicOp() {},
          } as unknown as SessionRecordManager;
          const selected = await runWithSessionRecorder(recorder, () =>
            provider!.getAction(game.request),
          );
          expect(selected).toEqual(confirm ? action : null);
          expect(requests).toBe(2);
          expect(receipts).toHaveLength(1);
          expect(records).toHaveLength(1);
          expect(records[0]!.finalAction ?? null).toEqual(confirm ? action : null);
          const privateTrace = JSON.stringify(records[0]);
          expect(privateTrace).toContain("confirmation_required");
          expect(privateTrace).toContain(receipts[0].confirmation_id);
          expect(privateTrace).toContain(confirm ? "confirmed" : "confirmation_required");
          expect(events.every((e) => e.visibility === "private")).toBe(true);
          expect(game.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
          expect(game.phaseManager.getEvents().some((e) => e.type === "wolf_self_destruct")).toBe(
            false,
          );
        } finally {
          await provider?.close();
          await runtime?.close();
          server.stop(true);
        }
      });

for (const locale of ["zh-CN", "en"] as const)
  for (const confirm of [false, true])
    test(`ACP MCP/${locale}: 首次回执保持窗口开放，${confirm ? "第二次确认" : "关闭跳过"}`, async () => {
      const game = fixture(locale),
        registry = new AcpTurnRegistry(game.world),
        control = new WerewolfMcpControlServer(registry);
      const client = new Client({ name: "confirmation-test", version: "1.0.0" });
      try {
        const config = await control.start(process.execPath, [
          path.resolve("src/adapters/acp/werewolf-mcp-server.ts"),
        ]);
        control.bindSession("confirmation");
        const pending = registry.openTurn(game.request, "confirmation");
        await client.connect(
          new StdioClientTransport({
            command: config.command,
            args: config.args,
            env: Object.fromEntries(config.env.map((x) => [x.name, x.value])),
          }),
        );
        const input = { turn_id: pending.turnId, action: action.name, arguments: action.args };
        const first = (await client.callTool({ name: "submit_action", arguments: input }))
          .structuredContent as any;
        expect(first).toMatchObject({
          ok: true,
          accepted: false,
          applied: false,
          status: "confirmation_required",
        });
        expect(registry.snapshot.pending).toBe(1);
        let resolved = false;
        void pending.action.then(() => {
          resolved = true;
        });
        await Promise.resolve();
        expect(resolved).toBe(false);
        const duplicate = (await client.callTool({ name: "submit_action", arguments: input }))
          .structuredContent;
        expect(duplicate).toEqual(first);
        if (confirm) {
          const second = (
            await client.callTool({
              name: "submit_action",
              arguments: { ...input, confirmation_id: first.confirmation_id },
            })
          ).structuredContent;
          expect(second).toMatchObject({
            ok: true,
            accepted: true,
            applied: false,
            status: "confirmed",
          });
        } else registry.closeTurn("confirmation");
        expect(await pending.action).toEqual(confirm ? action : null);
        expect(registry.snapshot.pending).toBe(0);
        expect(game.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
      } finally {
        registry.close();
        await client.close();
        await control.close({ force: true });
      }
    });
