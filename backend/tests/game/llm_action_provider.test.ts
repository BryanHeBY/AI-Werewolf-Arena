import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { RoleComponent } from "../../src/domain/components/role";
import { ActionProvider, ActionRequest, Phase, ToolCall } from "../../src/domain/model";
import { sixPlayerMvpConfig } from "../../src/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";
import { LlmActionProvider } from "../../src/agents/llm/llm_action_provider";
import { getSeerState, getWitchState } from "../../src/mechanisms/roles/private_state";
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

class NoActionToolLoopClient {
  public lastMessages: Array<{ role: string; content: string }> = [];

  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    _callbacks: {
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
    return { finalAction: null, assistantText: "tool_loop_finished_without_action" };
  }
}

class InvalidPotionThenNoneToolLoopClient {
  public lastMessages: Array<{ role: string; content: string }> = [];
  public invalidPotionResult: Record<string, unknown> | string | undefined;

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
    const invalid = await callbacks.onToolCall({
      id: "tool_heal_1",
      name: "use_potion",
      args: { target_id: 2, potion_type: "heal" },
      rawArgs: '{"target_id":2,"potion_type":"heal"}',
    });
    this.invalidPotionResult = invalid.toolResult;
    const valid = await callbacks.onToolCall({
      id: "tool_none_1",
      name: "use_potion",
      args: { target_id: 2, potion_type: "none" },
      rawArgs: '{"target_id":2,"potion_type":"none"}',
    });
    return {
      finalAction: (valid.finalAction ?? null) as T | null,
      assistantText: "invalid_potion_then_none",
    };
  }
}

class CaptureToolsClient {
  public lastToolNames: string[] = [];
  public lastTools: Array<{ name: string; description?: string; parameters?: any }> = [];
  public lastOptions: { toolChoice?: "auto" | "required" } | undefined;

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
    options?: { toolChoice?: "auto" | "required" },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    this.lastTools = tools;
    this.lastToolNames = tools.map((tool) => tool.name);
    this.lastOptions = options;
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
        expect(lines.length).toBe(4);
        expect(lines[0]).toContain("[行动提示]");
        expect(lines[0]).toContain("目前是你的发言轮次");
        expect(lines[1]).toContain("阶段规则：");
        expect(lines[2]).toContain("本轮结束前需满足");
        expect(lines[3]).toContain("工具参数提示：");
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

  test("sdk loop falls back when it completes without a required action", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new NoActionToolLoopClient() as any,
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

  test("mustAct=true should require a game action tool", async () => {
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
    expect(client.lastOptions?.toolChoice).toBe("required");
  });

  test("mustAct=false should permit a tool-less response", async () => {
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
    expect(client.lastOptions?.toolChoice).toBe("auto");
  });

  test("optional self-destruct window should allow completion without self_destruct", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const wolfId = context.playerIds.find(
      (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "wolf",
    )!;
    const provider = new LlmActionProvider(context.world, new NoActionToolLoopClient() as any);

    const action = await provider.getAction({
      phase: Phase.Voting,
      actorId: wolfId,
      allowedTools: ["self_destruct"],
      context: {
        day: 1,
        window: "on_pre_vote",
        turn_constraints: {
          min_valid_actions: 0,
          max_valid_actions: 1,
          required_any_tools: [],
        },
      },
    });

    expect(action).toBeNull();
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

    const reportBugTool = client.lastTools.find((tool) => tool.name === "report_bug");
    expect(reportBugTool?.description).toContain("明确规则、状态、流程、日志或可见信息矛盾");
    expect(reportBugTool?.description).toContain("正常的策略分歧、身份声称、诈身份或信息不足");
    expect(reportBugTool?.parameters?.properties?.message?.description).toContain(
      "观察到什么、按什么规则或状态本应如何、两者为何矛盾",
    );
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
      new NoActionToolLoopClient() as any,
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

  test("mustAct should fall back immediately when sdk tool loop throws runtime error", async () => {
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
      args: { text: "fallback_should_not_be_used" },
    });
  });

  test("witch prompt should include wolf target hint before potion action", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const witchId = context.world
      .entityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === "witch";
      })!;
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient(
        `{"name":"use_potion","args":{"target_id":${witchId},"potion_type":"none"}}`,
        (messages) => {
          const user = messages.find((msg) => msg.role === "user")?.content ?? "";
          expect(user).toContain("当前已知昨夜刀口是3号");
        },
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: witchId,
      allowedTools: ["use_potion"],
      context: { must_act: true, phase: "witch", wolf_target: 3, broadcast_feed: [] },
    });

    expect(action).toEqual({
      name: "use_potion",
      args: { target_id: witchId, potion_type: "none" },
    });
  });

  test("witch prompt should expose remaining potions and reject unavailable heal in tool loop", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const witchId = context.world
      .entityIds()
      .find((id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "witch")!;
    const witch = context.world.getComponent<RoleComponent>(witchId, COMPONENT.Role)!;
    getWitchState(witch)!.heal = 0;
    const client = new InvalidPotionThenNoneToolLoopClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: witchId,
      allowedTools: ["use_potion"],
      context: { must_act: true, phase: "witch", wolf_target: 2 },
    });

    expect(action).toEqual({
      name: "use_potion",
      args: { target_id: 2, potion_type: "none" },
    });
    expect(client.invalidPotionResult).toEqual({ ok: false, error: "非法操作，解药不可用" });
    const user = client.lastMessages.find((message) => message.role === "user")?.content ?? "";
    expect(user).toContain("你的私有状态：你的底牌是【女巫】。解药:0 毒药:1");
  });

  test("on_pre_vote self_destruct window should include strict tool boundary hint", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const wolfId = context.world
      .entityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === "wolf";
      })!;
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient(
        '{"name":"self_destruct","args":{"reason":"test","confirm":true}}',
        (messages) => {
          const user = messages.find((msg) => msg.role === "user")?.content ?? "";
          expect(user).toContain("唯一会改变局面的动作是 self_destruct");
        },
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Voting,
      actorId: wolfId,
      allowedTools: ["self_destruct"],
      context: { must_act: false, phase: "on_pre_vote" },
    });

    expect(action).toEqual({
      name: "self_destruct",
      args: { reason: "test", confirm: true },
    });
  });

  test("sdk self-destruct window should allow a tool-less no-action response", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const wolfId = context.world
      .entityIds()
      .find((id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "wolf")!;
    const client = new NoActionToolLoopClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    const action = await provider.getAction({
      phase: Phase.Voting,
      actorId: wolfId,
      allowedTools: ["self_destruct"],
      context: { must_act: false, phase: "on_pre_vote" },
    });

    expect(action).toBeNull();
    const user = client.lastMessages.find((message) => message.role === "user")?.content ?? "";
    expect(user).toContain("若选择不自爆，直接结束本次回复即可");
    expect(user).toContain("你当前可以使用的工具有：self_destruct, report_bug");
  });

  test("initial system prompt should include rendered board config summary", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"ok"}}', (messages) => {
        const system = messages.find((msg) => msg.role === "system")?.content ?? "";
        expect(system).toContain("本局规则配置");
        expect(system).toContain("胜利条件");
        expect(system).toContain("警长机制");
      }),
      {
        fallbackProvider: new FallbackProvider(null),
        boardConfig: twelvePlayerStandardConfig,
      },
    );

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { must_act: true, broadcast_feed: [] },
    });
  });

  test("system prompt should require tools for every effective game action", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new ToolLoopClient("speak", { text: "通过工具发言" });
    const provider = new LlmActionProvider(context.world, client as any);

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { must_act: true, broadcast_feed: [] },
    });

    const system = client.lastMessages.find((message) => message.role === "system")?.content ?? "";
    expect(system).toContain("所有能起效的行动都必须通过函数工具调用提交");
    expect(system).toContain("普通 assistant 文本只会被当作本地思考");
    expect(system).toContain("发言请把内容写入 speak.text 或 speak_to_wolves.text");
    expect(system).toContain("可以先调用 report_bug 上报，再继续本轮正常行动");
    const user = client.lastMessages.find((message) => message.role === "user")?.content ?? "";
    expect(user).toContain("正常策略分歧、身份声称、诈身份或信息不足不是 bug");
  });
});
