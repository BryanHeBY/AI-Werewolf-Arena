import { describe, expect, test } from "bun:test";
import { PotionType } from "../../../src/core";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { RoleComponent } from "../../../src/core/domain/components/role";
import { Phase } from "../../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { AiSdkClient } from "../../../src/ai/integrations/llm/ai_sdk_client";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import path from "path";
import { promises as fs } from "fs";
import { createTestTempDirectory } from "../../support/temp_directory";
import {
  REQUIRED_ACTION_CONSTRAINTS,
  ToolLoopClient,
  GenericSubmitActionClient,
  CaptureToolsClient,
  FallbackProvider,
} from "../../support/llm_provider_clients";

describe("LlmActionProvider protocol", () => {
  test("accepts a native tool callback", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("speak", { text: "我是1号" }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        visible_events: [],
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "我是1号" },
    });
  });

  test("accepts a native vote callback", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("vote", { target_id: 2, abstain: false }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Voting,
      actorId: 1,
      allowedTools: ["vote"],
      context: { day: 1, stage: "voting", visible_events: [], turn_constraints: {} },
    });

    expect(action).toEqual({
      name: "vote",
      args: { target_id: 2, abstain: false },
    });
  });

  test("accepts a native role-action callback", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const seerId = context.world
      .entityIds()
      .find(
        (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "seer",
      )!;
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("check_identity", { target_id: 2 }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: seerId,
      allowedTools: ["check_identity"],
      context: { day: 1, stage: "seer", visible_events: [], turn_constraints: {} },
    });

    expect(action).toEqual({
      name: "check_identity",
      args: { target_id: 2 },
    });
  });

  test("accepts a native speak callback without text recovery", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("speak", { text: "我应该谨慎发言，先保留态度，观察局势。" }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
    });

    expect(action?.name).toBe("speak");
    expect((action as any)?.args?.text?.length).toBeGreaterThan(0);
  });

  test("passes the callback arguments through the native protocol", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("speak", { text: "我应该谨慎发言。" }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 6,
      allowedTools: ["speak"],
      context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
    });

    expect(action?.name).toBe("speak");
    expect((action as any)?.args?.text).toBe("我应该谨慎发言。");
  });

  test("uses sdk tool loop as primary path", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const toolClient = new ToolLoopClient("speak", { text: "sdk_action" });
    const provider = new LlmActionProvider(context.world, toolClient as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        visible_events: [],
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "sdk_action" },
    });
  });

  test("accepts game actions through the shared submit_action contract", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(context.world, new GenericSubmitActionClient() as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    await expect(
      provider.getAction({
        phase: Phase.Day,
        actorId: 1,
        allowedTools: ["speak"],
        context: {
          day: 1,
          stage: "day_speech",
          visible_events: [],
          turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        },
      }),
    ).resolves.toEqual({
      name: "speak",
      args: { text: "通过统一协议发言" },
    });
  });

  test("returns actionable turn-id feedback and accepts a corrected witch action", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const root = await createTestTempDirectory("turn-id-feedback-");
    const recorder = await SessionRecordManager.create(
      {
        sessionId: "session_turn_id_feedback",
        board: "twelve_player_standard",
        startedAtIso: new Date().toISOString(),
      },
      root,
    );
    const witchId = context.world
      .entityIds()
      .find(
        (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "witch",
      )!;
    const client = {
      chat: async () => "",
      async runToolLoop<T>(_messages: unknown, _tools: unknown, callbacks: any) {
        const submit = (turnId: string) =>
          callbacks.onToolCall({
            id: `call-${turnId}`,
            name: "submit_action",
            rawArgs: "{}",
            args: {
              turn_id: turnId,
              action: "use_potion",
              arguments: { target_id: witchId, potion_type: PotionType.None },
            },
          });
        const rejected = await submit("t2");
        expect(rejected.toolResult).toMatchObject({
          ok: false,
          error: "turn_id_mismatch",
          expected_turn_id: "t1",
          received_turn_id: "t2",
        });
        expect(rejected.finalAction).toBeUndefined();
        const accepted = await submit(rejected.toolResult.expected_turn_id);
        expect(accepted.toolResult.ok).toBe(true);
        return { finalAction: accepted.finalAction as T, assistantText: "" };
      },
    };
    const provider = new LlmActionProvider(context.world, client, {
      fallbackProvider: new FallbackProvider(null),
    });
    await expect(
      runWithSessionRecorder(recorder, () =>
        provider.getAction({
          phase: Phase.Night,
          actorId: witchId,
          allowedTools: ["use_potion"],
          context: {
            visible_events: [],
            day: 1,
            stage: "witch",
            turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
          },
        }),
      ),
    ).resolves.toEqual({
      name: "use_potion",
      args: { target_id: witchId, potion_type: PotionType.None },
    });
    await recorder.flushNow();
    const logic = JSON.parse(
      await fs.readFile(path.join(recorder.sessionDir, "logic_ops.json"), "utf8"),
    );
    expect(logic.ops).toContainEqual(
      expect.objectContaining({
        op: "tool_call_rejected",
        status: "rejected",
        reason: "turn_id_mismatch",
        input: expect.objectContaining({ args: expect.objectContaining({ turn_id: "t2" }) }),
        output: expect.objectContaining({ expected_turn_id: "t1", received_turn_id: "t2" }),
      }),
    );
  });

  test("retries a text-only required-tool response and completes the witch turn", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const witchId = context.world
      .entityIds()
      .find(
        (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "witch",
      )!;
    let requests = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as any;
        requests++;
        expect(body.tool_choice).toBe("required");
        let message: Record<string, unknown> = { role: "assistant", content: "我未能提交行动" };
        if (requests > 1) {
          const prompt = body.messages.findLast((item: any) =>
            item.content?.includes("turn_id 必须为"),
          );
          const turnId = prompt.content.match(/turn_id 必须为 (t\d+)/)[1];
          expect(body.messages.at(-1).content).toContain("重试 1/3");
          message = {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "corrected-action",
                type: "function",
                function: {
                  name: "submit_action",
                  arguments: JSON.stringify({
                    turn_id: turnId,
                    action: "use_potion",
                    arguments: { target_id: witchId, potion_type: PotionType.None },
                  }),
                },
              },
            ],
          };
        }
        return Response.json({
          id: "chatcmpl-witch",
          object: "chat.completion",
          created: 1,
          model: "test-model",
          choices: [{ index: 0, message, finish_reason: requests === 1 ? "stop" : "tool_calls" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    try {
      const provider = new LlmActionProvider(
        context.world,
        new AiSdkClient({
          apiKey: "test-key",
          baseURL: `${server.url.origin}/v1`,
          model: "test-model",
        }),
        { llmTimeoutMs: 5000, fallbackProvider: new FallbackProvider(null) },
      );
      await expect(
        provider.getAction({
          phase: Phase.Night,
          actorId: witchId,
          allowedTools: ["use_potion"],
          context: {
            visible_events: [],
            day: 1,
            stage: "witch",
            turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
          },
        }),
      ).resolves.toEqual({
        name: "use_potion",
        args: { target_id: witchId, potion_type: PotionType.None },
      });
      expect(requests).toBe(2);
    } finally {
      server.stop(true);
    }
  });

  test("exposes the generic game tool contract", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new CaptureToolsClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    await provider.getAction({
      phase: Phase.Voting,
      actorId: 1,
      allowedTools: ["vote"],
      context: { day: 1, stage: "voting", visible_events: [], turn_constraints: {} },
    });

    expect(client.lastToolNames).toEqual(["get_game_schema", "submit_action", "report_bug"]);
    const submitTool = client.lastTools.find((tool) => tool.name === "submit_action");
    expect(submitTool?.description).toContain("accepted=true、applied=false");
    expect(submitTool?.parameters?.required).toEqual(["turn_id", "action", "arguments"]);
    expect(submitTool?.parameters?.properties?.turn_id?.type).toBe("string");
    expect(submitTool?.parameters?.properties?.action?.type).toBe("string");

    const reportBugTool = client.lastTools.find((tool) => tool.name === "report_bug");
    expect(reportBugTool?.description).toContain("明确的规则、流程、状态、日志或可见性矛盾");
    expect(reportBugTool?.parameters?.required).toEqual([
      "turn_id",
      "category",
      "severity",
      "message",
    ]);
  });
});
