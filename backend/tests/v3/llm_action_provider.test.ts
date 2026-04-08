import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { RoleComponent } from "../../src/domain/components/role";
import { ActionProvider, ActionRequest, Phase, ToolCall } from "../../src/domain/model";
import { sixPlayerMvpConfig } from "../../src/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../src/v3/llm_action_provider";

class FakeClient {
  constructor(private readonly output: string) {}

  async chat(): Promise<string> {
    return this.output;
  }
}

class AssertClient {
  constructor(
    private readonly output: string,
    private readonly assertFn: (messages: Array<{ role: string; content: string }>) => void,
  ) {}

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    this.assertFn(messages);
    return this.output;
  }
}

class ToolLoopClient {
  public lastMessages: Array<{ role: string; content: string }> = [];

  constructor(
    private readonly toolName: string,
    private readonly args: Record<string, unknown>,
  ) {}

  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    this.lastMessages = messages;
    const handled = await callbacks.onToolCall({
      id: "tool_1",
      name: this.toolName,
      args: this.args,
      rawArgs: JSON.stringify(this.args),
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "sdk_tool_loop_assistant",
    };
  }
}

class FinishTurnOnlyClient {
  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    _messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    await callbacks.onToolCall({
      id: "finish_1",
      name: "finish_turn",
      args: {},
      rawArgs: "{}",
    });
    return { finalAction: null, assistantText: "finish_turn_called" };
  }
}

class FallbackProvider implements ActionProvider {
  constructor(private readonly action: ToolCall | null) {}

  async getAction(_request: ActionRequest): Promise<ToolCall | null> {
    return this.action;
  }
}

describe("LlmActionProvider", () => {
  test("parses valid json tool call", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FakeClient('{"name":"speak","args":{"text":"我是1号"}}'),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {},
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "我是1号" },
    });
  });

  test("supports fenced json response", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FakeClient("```json\n{\"name\":\"vote\",\"args\":{\"target_id\":2}}\n```"),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Voting,
      actorId: 1,
      allowedTools: ["vote"],
      context: {},
    });

    expect(action).toEqual({
      name: "vote",
      args: { target_id: 2 },
    });
  });

  test("parses tool call when model includes <think> wrapper", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FakeClient(
        "<think>先分析一下局势</think>\n{\"name\":\"check_identity\",\"args\":{\"target_id\":2}}",
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: 5,
      allowedTools: ["check_identity"],
      context: {},
    });

    expect(action).toEqual({
      name: "check_identity",
      args: { target_id: 2 },
    });
  });

  test("falls back when llm returns disallowed tool", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const fallback = new FallbackProvider({
      name: "speak",
      args: { text: "fallback_speak" },
    });
    const provider = new LlmActionProvider(
      context.world,
      new FakeClient('{"name":"vote","args":{"target_id":2}}'),
      {
        fallbackProvider: fallback,
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {},
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "fallback_speak" },
    });
  });

  test("recovers speak action from think-only output", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FakeClient("<think>我应该谨慎发言，先保留态度，观察局势。</think>"),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {},
    });

    expect(action?.name).toBe("speak");
    expect((action as any)?.args?.text?.length).toBeGreaterThan(0);
  });

  test("recovered speak should not echo prompt metadata", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FakeClient(
        "<think>actorId=6 phase=day allowedTools=[\"speak\"] context={\"phase\":\"day_speech\"} 我应该谨慎发言。</think>",
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 6,
      allowedTools: ["speak"],
      context: {},
    });

    expect(action?.name).toBe("speak");
    const text = (action as any)?.args?.text ?? "";
    expect(text.toLowerCase()).not.toContain("actorid=");
    expect(text.toLowerCase()).not.toContain("allowedtools=");
    expect(text.toLowerCase()).not.toContain("context=");
  });

  test("prompt no longer contains private-intel snapshot line", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const seerId = 5;
    const seerRole = context.world.getComponent<RoleComponent>(seerId, COMPONENT.Role)!;
    seerRole.seerState!.lastTarget = 1;
    seerRole.seerState!.lastIsWerewolf = true;
    seerRole.seerState!.history.push({ targetId: 1, isWerewolf: true });

    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"收到查验"}}', (messages) => {
        const joined = messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n");
        expect(joined).not.toContain("私有查验情报=");
      }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: seerId,
      allowedTools: ["speak"],
      context: {},
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "收到查验" },
    });
  });

  test("falls back when model returns none but action is required", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FakeClient('{"name":"none","args":{}}'),
      {
        fallbackProvider: new FallbackProvider({
          name: "speak",
          args: { text: "fallback_required_action" },
        }),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { must_act: true },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "fallback_required_action" },
    });
  });

  test("injects public feed as broadcast user lines", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"收到公开信息"}}', (messages) => {
        const joined = messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n");
        expect(joined).toContain("【广播】[发言][1] 我是1号，我是狼人");
        expect(joined).not.toContain("公开信息摘要=");
        expect(joined).not.toContain("阶段上下文=");
      }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 2,
      allowedTools: ["speak"],
      context: {
        must_act: true,
        public_feed: ["[发言][1] 我是1号，我是狼人"],
      },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "收到公开信息" },
    });
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
      context: { must_act: true },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "sdk_action" },
    });
  });

  test("appends broadcast lines into per-agent message history", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const toolClient = new ToolLoopClient("speak", { text: "收到广播" });
    const provider = new LlmActionProvider(context.world, toolClient as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        must_act: true,
        broadcast_feed: ["[系统][公开] 天亮了（第1天白天）"],
      },
    });

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        must_act: true,
        broadcast_feed: [
          "[系统][公开] 天亮了（第1天白天）",
          "[发言][公开][2] 我是2号",
        ],
      },
    });

    const joined = toolClient.lastMessages
      .map((msg) => `${msg.role}:${msg.content}`)
      .join("\n");
    expect(joined).toContain("【广播】[系统][公开] 天亮了（第1天白天）");
    expect(joined).toContain("【广播】[发言][公开][2] 我是2号");
  });

  test("sdk loop finish_turn falls back when action is required", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FinishTurnOnlyClient() as any,
      {
        fallbackProvider: new FallbackProvider({
          name: "speak",
          args: { text: "fallback_required_action" },
        }),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { must_act: true, broadcast_feed: [] },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "fallback_required_action" },
    });
  });
});
