/**
 * 单元测试验证 llm-action-provider-fallback 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { describe, expect, test } from "bun:test";
import { PotionType } from "../../../src/domain";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import { RoleComponent } from "../../../src/domain/components/role";
import { ActionWindow, Phase } from "../../../src/domain/model";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { twelvePlayerStandardConfig } from "../../../src/rulesets/presets/twelve-player-standard";
import { LlmActionProvider } from "../../../src/agents/llm/llm-action-provider";
import {
  REQUIRED_ACTION_CONSTRAINTS,
  ToolLoopClient,
  NoActionToolLoopClient,
  CaptureToolsClient,
  FailOnceThenSpeakToolLoopClient,
  FallbackProvider,
} from "../../support/drivers/agents/llm-clients";

describe("LlmActionProvider fallback", () => {
  test("falls back when llm returns disallowed tool", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const fallback = new FallbackProvider({
      name: "speak",
      args: { text: "fallback_speak" },
    });
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("vote", { target_id: 2 }),
      {
        privilegedFallbackProvider: fallback,
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
      args: { text: "fallback_speak" },
    });
  });

  test("does not invent an action when the native loop returns none", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const wolfId = context.world.getAliveEntityIds().find((id) => {
      const role = context.world.getComponent(id, COMPONENT.Role);
      return role?.role === "wolf";
    })!;

    const provider = new LlmActionProvider(context.world, new NoActionToolLoopClient(), {
      privilegedFallbackProvider: new FallbackProvider(null),
    });

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: wolfId,
      allowedTools: ["self_destruct"],
      context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
    });

    expect(action).toBeNull();
  });

  test("falls back when model returns none but action is required", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(context.world, new NoActionToolLoopClient(), {
      privilegedFallbackProvider: new FallbackProvider({
        name: "speak",
        args: { text: "fallback_required_action" },
      }),
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
      args: { text: "fallback_required_action" },
    });
  });

  test("sdk loop falls back when it completes without a required action", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(context.world, new NoActionToolLoopClient() as any, {
      privilegedFallbackProvider: new FallbackProvider({
        name: "speak",
        args: { text: "fallback_required_action" },
      }),
    });

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        visible_events: [],
      },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "fallback_required_action" },
    });
  });

  test("mustAct=true should require a game action tool", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new CaptureToolsClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      privilegedFallbackProvider: new FallbackProvider(null),
    });

    await provider.getAction({
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

    expect(client.lastToolNames).toEqual(["get_game_schema", "submit_action", "report_bug"]);
    expect(client.lastOptions?.toolChoice).toBe("required");
  });

  test("mustAct=false should permit a tool-less response", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new CaptureToolsClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      privilegedFallbackProvider: new FallbackProvider(null),
    });

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
    });

    expect(client.lastToolNames).toEqual(["get_game_schema", "submit_action", "report_bug"]);
    expect(client.lastOptions?.toolChoice).toBe("auto");
  });

  test("witch required action should fall back to use_potion none instead of dropped", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const provider = new LlmActionProvider(
      context.world,
      new NoActionToolLoopClient() as any,
      // 不传特权测试 provider，走生产默认的玩家观察回退。
    );

    const witchId = context.world.entityIds().find((id) => {
      const role = context.world.getComponent(id, COMPONENT.Role);
      return role?.role === "witch";
    })!;

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: witchId,
      allowedTools: ["use_potion"],
      context: {
        day: 1,
        stage: "witch",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        visible_events: [],
      },
    });

    expect(action).toEqual({
      name: "use_potion",
      args: { target_id: witchId, potion_type: PotionType.None },
    });
  });

  test("mustAct should fall back immediately when sdk tool loop throws runtime error", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FailOnceThenSpeakToolLoopClient() as any,
      {
        privilegedFallbackProvider: new FallbackProvider({
          name: "speak",
          args: { text: "fallback_should_not_be_used" },
        }),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        visible_events: [],
      },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "fallback_should_not_be_used" },
    });
  });

  test("sdk self-destruct window should allow a tool-less no-action response", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const wolfId = context.world
      .entityIds()
      .find(
        (id) => context.world.getComponent(id, COMPONENT.Role)?.role === "wolf",
      )!;
    const client = new NoActionToolLoopClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      privilegedFallbackProvider: new FallbackProvider(null),
    });

    const action = await provider.getAction({
      phase: Phase.Voting,
      actorId: wolfId,
      allowedTools: ["self_destruct"],
      context: { day: 1, visible_events: [], turn_constraints: {}, stage: ActionWindow.OnPreVote },
    });

    expect(action).toBeNull();
    const user = client.lastMessages.find((message) => message.role === "user")?.content ?? "";
    expect(user).toContain("若不自爆，直接结束本次回应，不提交行动");
    expect(user).toContain("你当前可以提交的行动有：self_destruct, report_bug");
  });
});
