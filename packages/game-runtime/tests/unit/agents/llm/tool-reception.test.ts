/**
 * 单元测试验证 tool-reception 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/domain/components/names";
import { RoleComponent } from "../../../../src/domain/components/role";
import { Phase } from "../../../../src/domain/model";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { LlmActionProvider } from "../../../../src/agents/llm/llm-action-provider";
import type { ChatModelClient } from "../../../../src/adapters/llm/transport";
import { getDefaultToolSpecRegistry } from "../../../../src/engine/actions/tool-spec-registry";
import {
  REQUIRED_ACTION_CONSTRAINTS,
  ToolLoopClient,
  GenericSubmitActionClient,
  CaptureToolsClient,
  FallbackProvider,
} from "../../../support/drivers/agents/llm-clients";

describe("LlmActionProvider protocol", () => {
  test("SDK 本轮说明和协议查询提供同一份完整参数 schema", async () => {
    const client: ChatModelClient = {
      async chat() {
        return "";
      },
      async runToolLoop(_messages, _tools, callbacks) {
        expect(_messages.some((message) => message.content.includes('"vote":{"anyOf":'))).toBe(
          true,
        );
        const result = await callbacks.onToolCall({
          id: "schema",
          name: "get_game_schema",
          args: {},
          rawArgs: "{}",
        });
        expect(result.toolResult).toHaveProperty(
          "actions",
          getDefaultToolSpecRegistry().parameterSchemas(),
        );
        return { finalAction: null, assistantText: "" };
      },
    };
    const provider = new LlmActionProvider(bootstrapGame(sixPlayerMvpConfig).world, client, {
      privilegedFallbackProvider: new FallbackProvider(null),
    });
    try {
      await provider.getAction({
        phase: Phase.Voting,
        actorId: 1,
        allowedTools: ["vote"],
        context: {
          day: 1,
          stage: "voting",
          visible_events: [],
          turn_constraints: { min_valid_actions: 0 },
        },
      });
    } finally {
      await provider.close();
    }
  });
  test("accepts a native tool callback", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("speak", { text: "我是1号" }),
      {
        privilegedFallbackProvider: new FallbackProvider(null),
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
        privilegedFallbackProvider: new FallbackProvider(null),
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
      .find((id) => context.world.getComponent(id, COMPONENT.Role)?.role === "seer")!;
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("check_identity", { target_id: 2 }),
      {
        privilegedFallbackProvider: new FallbackProvider(null),
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
        privilegedFallbackProvider: new FallbackProvider(null),
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
        privilegedFallbackProvider: new FallbackProvider(null),
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
      privilegedFallbackProvider: new FallbackProvider(null),
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
      privilegedFallbackProvider: new FallbackProvider(null),
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

  test("exposes the generic game tool contract", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new CaptureToolsClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      privilegedFallbackProvider: new FallbackProvider(null),
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
