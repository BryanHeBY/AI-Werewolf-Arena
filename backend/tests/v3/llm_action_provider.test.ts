import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { RoleComponent } from "../../src/domain/components/role";
import { ActionProvider, ActionRequest, Phase, ToolCall } from "../../src/domain/model";
import { sixPlayerMvpConfig } from "../../src/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";
import { LlmActionProvider } from "../../src/agents/llm/llm_action_provider";
import { getSeerState } from "../../src/mechanisms/roles/private_state";
import { SessionRecordHub, SessionRecordManager } from "../../src/session_recording";
import os from "os";
import path from "path";
import { promises as fs } from "fs";

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

class CaptureToolsClient {
  public lastToolNames: string[] = [];
  public lastTools: Array<{ name: string; description?: string; parameters?: any }> = [];

  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    _messages: Array<{ role: string; content: string }>,
    tools: Array<{ name: string; description?: string; parameters?: any }>,
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
    this.lastTools = tools;
    this.lastToolNames = tools.map((tool) => tool.name);
    const handled = await callbacks.onToolCall({
      id: "tool_1",
      name: "speak",
      args: { text: "capture_tools" },
      rawArgs: '{"text":"capture_tools"}',
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "capture_tools_assistant",
    };
  }
}

class FailOnceThenSpeakToolLoopClient {
  private failed = false;

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
    if (!this.failed) {
      this.failed = true;
      throw new Error("simulated_runtime_error_once");
    }
    const handled = await callbacks.onToolCall({
      id: "tool_retry_1",
      name: "speak",
      args: { text: "retry_success" },
      rawArgs: '{"text":"retry_success"}',
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "retry_assistant",
    };
  }
}

class ReportThenSpeakToolLoopClient {
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
      id: "tool_bug_1",
      name: "report_bug",
      args: {
        category: "flow",
        severity: "high",
        message: "测试：白痴翻牌日志未显示",
      },
      rawArgs:
        '{"category":"flow","severity":"high","message":"测试：白痴翻牌日志未显示"}',
    });
    const handled = await callbacks.onToolCall({
      id: "tool_speak_1",
      name: "speak",
      args: { text: "继续发言" },
      rawArgs: '{"text":"继续发言"}',
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "report_then_speak",
    };
  }
}

class DuplicateReportThenSpeakToolLoopClient {
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
      id: "tool_bug_1",
      name: "report_bug",
      args: {
        category: "flow",
        severity: "high",
        message: "测试：白天流程异常",
      },
      rawArgs: '{"category":"flow","severity":"high","message":"测试：白天流程异常"}',
    });
    await callbacks.onToolCall({
      id: "tool_bug_2",
      name: "report_bug",
      args: {
        category: "flow",
        severity: "high",
        message: "测试：白天流程异常",
      },
      rawArgs: '{"category":"flow","severity":"high","message":"测试：白天流程异常"}',
    });
    const handled = await callbacks.onToolCall({
      id: "tool_speak_1",
      name: "speak",
      args: { text: "继续发言" },
      rawArgs: '{"text":"继续发言"}',
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "duplicate_report_then_speak",
    };
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
      new FakeClient(
        "```json\n{\"name\":\"vote\",\"args\":{\"target_id\":2,\"abstain\":false}}\n```",
      ),
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
      args: { target_id: 2, abstain: false },
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

  test("should not recover self_destruct from think text", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const wolfId = context.world
      .getAliveEntityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === "wolf";
      })!;

    const provider = new LlmActionProvider(
      context.world,
      new FakeClient("<think>当前局面不利，我考虑自爆结束这个回合。</think>"),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: wolfId,
      allowedTools: ["self_destruct"],
      context: { must_act: false },
    });

    expect(action).toBeNull();
  });

  test("should accept report_bug as optional tool and continue to final action", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-report-bug-"));
    const recorder = await SessionRecordManager.create(
      {
        sessionId: "session_report_bug_test",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-11T00:00:00.000Z").toISOString(),
      },
      root,
    );
    SessionRecordHub.setActive(recorder);

    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ReportThenSpeakToolLoopClient(),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { day: 1, phase: "day_speech", must_act: true },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "继续发言" },
    });

    await recorder.finalize({
      endedAtIso: new Date("2026-04-11T00:00:01.000Z").toISOString(),
      winner: null,
      finishReason: "test_done",
      players: context.world.entityIds().map((id) => ({
        player_id: id,
        role:
          context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role ??
          "unknown",
        camp:
          context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp ??
          "unknown",
        alive: true,
      })),
    });
    SessionRecordHub.setActive(null);

    const reports = JSON.parse(
      await fs.readFile(
        path.join(root, "session_report_bug_test", "debug_reports.json"),
        "utf-8",
      ),
    );
    expect(reports.reports.length).toBe(1);
    expect(reports.reports[0].category).toBe("flow");
    expect(reports.reports[0].severity).toBe("high");
  });

  test("should rate-limit duplicated report_bug in same stage", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-report-bug-dup-"));
    const recorder = await SessionRecordManager.create(
      {
        sessionId: "session_report_bug_dedupe_test",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-11T00:00:00.000Z").toISOString(),
      },
      root,
    );
    SessionRecordHub.setActive(recorder);

    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new DuplicateReportThenSpeakToolLoopClient(),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { day: 1, phase: "day_speech", must_act: true },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "继续发言" },
    });

    await recorder.finalize({
      endedAtIso: new Date("2026-04-11T00:00:01.000Z").toISOString(),
      winner: null,
      finishReason: "test_done",
      players: context.world.entityIds().map((id) => ({
        player_id: id,
        role:
          context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role ??
          "unknown",
        camp:
          context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp ??
          "unknown",
        alive: true,
      })),
    });
    SessionRecordHub.setActive(null);

    const reports = JSON.parse(
      await fs.readFile(
        path.join(root, "session_report_bug_dedupe_test", "debug_reports.json"),
        "utf-8",
      ),
    );
    expect(reports.reports.length).toBe(1);

    const logicOps = JSON.parse(
      await fs.readFile(
        path.join(root, "session_report_bug_dedupe_test", "logic_ops.json"),
        "utf-8",
      ),
    );
    expect(
      logicOps.ops.some(
        (op: any) =>
          op.op === "report_bug_dropped" &&
          op.reason === "report_bug_scope_rate_limited",
      ),
    ).toBe(true);
  });

  test("prompt no longer contains private-intel snapshot line", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const seerId = context.world
      .entityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === "seer";
      })!;
    const seerRole = context.world.getComponent<RoleComponent>(seerId, COMPONENT.Role)!;
    const seerState = getSeerState(seerRole)!;
    seerState.lastTarget = 1;
    seerState.lastIsWerewolf = true;
    seerState.history.push({ targetId: 1, isWerewolf: true });

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

  test("user prompt should use compact three-line natural language format", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"收到板子信息"}}', (messages) => {
        const systemMessages = messages
          .filter((m) => m.role === "system")
          .map((m) => m.content)
          .join("\n");
        expect(systemMessages).toContain("当前板子信息");
        expect(systemMessages).toContain("总玩家数=6");
        expect(systemMessages).toContain("角色构成=");
        expect(systemMessages).toContain("角色技能简介=");
        expect(systemMessages).toContain("当你看到“[行动提示]”时，说明你可以开始行动了");

        const userMessages = messages
          .filter((m) => m.role === "user")
          .map((m) => m.content);
        const latest = userMessages[userMessages.length - 1] ?? "";
        const lines = latest.split("\n");
        expect(lines.length).toBe(3);
        expect(lines[0]).toContain("[行动提示]");
        expect(lines[0]).toContain("目前是你的发言轮次");
        expect(lines[1]).toContain("你本轮必须至少调用一次可用工具完成行动");
        expect(lines[2]).toContain("工具参数提示：");
        expect(latest).not.toContain("玩家编号=");
        expect(latest).not.toContain("当前板子信息");
      }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { must_act: true, phase: "day_speech" },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "收到板子信息" },
    });
  });

  test("target_id tools should include actionable ids hint with role-specific self override", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const wolfId = context.world
      .entityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === "wolf";
      })!;
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient(
        '{"name":"kill_vote","args":{"target_id":null,"abstain":true}}',
        (messages) => {
          const user = messages
            .filter((m) => m.role === "user")
            .map((m) => m.content)
            .join("\n");
          expect(user).toContain("可行动ID（含你自己）：");
          expect(user).toContain(String(wolfId));
        },
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: wolfId,
      allowedTools: ["kill_vote"],
      context: { must_act: true, phase: "wolf_vote" },
    });

    expect(action).toEqual({
      name: "kill_vote",
      args: { target_id: null, abstain: true },
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

  test("mustAct=true should not expose finish_turn tool", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new CaptureToolsClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { must_act: true },
    });

    expect(client.lastToolNames).toContain("speak");
    expect(client.lastToolNames).not.toContain("finish_turn");
  });

  test("mustAct=false should expose finish_turn tool", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new CaptureToolsClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { must_act: false },
    });

    expect(client.lastToolNames).toContain("speak");
    expect(client.lastToolNames).toContain("finish_turn");
  });

  test("sdk tools should include function and parameter descriptions", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new CaptureToolsClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    await provider.getAction({
      phase: Phase.Voting,
      actorId: 1,
      allowedTools: ["vote"],
      context: { must_act: false },
    });

    const voteTool = client.lastTools.find((tool) => tool.name === "vote");
    expect(voteTool?.description).toContain("放逐投票");
    expect(voteTool?.parameters?.description).toContain("放逐投票参数");
    expect(voteTool?.parameters?.required).toEqual(["target_id", "abstain"]);
    expect(voteTool?.parameters?.properties?.target_id?.description).toContain("弃票时必须为 null");
    expect(voteTool?.parameters?.properties?.abstain?.description).toContain("是否弃票");

    const finishTurnTool = client.lastTools.find((tool) => tool.name === "finish_turn");
    expect(finishTurnTool?.description).toContain("不再继续行动");
    expect(finishTurnTool?.parameters?.description).toContain("空参数对象");
  });

  test("system prompt should explicitly distinguish wolf discussion and wolf vote stages", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient(
        '{"name":"speak_to_wolves","args":{"text":"收到","end_chat":false}}',
        (messages) => {
        const system = messages.find((msg) => msg.role === "system")?.content ?? "";
        const user = messages.find((msg) => msg.role === "user")?.content ?? "";
        expect(system).toContain("狼人交流阶段");
        expect(system).toContain("不会在本阶段完成刀人");
        expect(system).toContain("end_chat=true");
        expect(user).toContain(
          'speak_to_wolves args: {"text":"...","end_chat":true|false}',
        );
      },
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    await provider.getAction({
      phase: Phase.Night,
      actorId: 1,
      allowedTools: ["speak_to_wolves"],
      context: { must_act: true },
    });
  });

  test("witch required action should fall back to use_potion none instead of dropped", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FinishTurnOnlyClient() as any,
      // 不传 fallbackProvider，走 BaselineBotActionProvider 默认兜底。
    );

    const witchId = context.world
      .entityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === "witch";
      })!;

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: witchId,
      allowedTools: ["use_potion"],
      context: { must_act: true, broadcast_feed: [] },
    });

    expect(action).toEqual({
      name: "use_potion",
      args: { target_id: witchId, potion_type: "none" },
    });
  });

  test("parses wolf kill abstain vote", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FakeClient('{"name":"kill_vote","args":{"target_id":null,"abstain":true}}'),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: 1,
      allowedTools: ["kill_vote"],
      context: { must_act: true },
    });

    expect(action).toEqual({
      name: "kill_vote",
      args: { target_id: null, abstain: true },
    });
  });

  test("mustAct should retry when sdk tool loop throws runtime error", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new FailOnceThenSpeakToolLoopClient() as any,
      {
        fallbackProvider: new FallbackProvider({
          name: "speak",
          args: { text: "fallback_should_not_be_used" },
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
      args: { text: "retry_success" },
    });
  });
});
