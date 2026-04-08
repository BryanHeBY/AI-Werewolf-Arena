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

  test("seer private intel is injected into prompt after check result is written", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const seerId = 5;
    const seerRole = context.world.getComponent<RoleComponent>(seerId, COMPONENT.Role)!;
    seerRole.seerState!.lastTarget = 1;
    seerRole.seerState!.lastIsWerewolf = true;
    seerRole.seerState!.history.push({ targetId: 1, isWerewolf: true });

    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"收到查验"}}', (messages) => {
        const user = messages.find((m) => m.role === "user")?.content ?? "";
        expect(user).toContain("私有查验情报=你最近一次查验：1号是狼人");
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

  test("injects public feed into prompt for downstream reasoning", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"收到公开信息"}}', (messages) => {
        const user = messages.find((m) => m.role === "user")?.content ?? "";
        expect(user).toContain("公开信息摘要=[发言][1] 我是1号，我是狼人");
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
});
