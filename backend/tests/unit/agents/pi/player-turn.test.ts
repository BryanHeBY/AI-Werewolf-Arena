/**
 * 以受控内存传输测试真实 Pi 玩家编排，预期由字面回执、提示输入和关闭时序给出。
 * 不启动模型，不提交领域动作；录制捕获使用局部作用域，失败前缀不依赖终端开关。
 */
import { describe, expect, spyOn, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  PiActionProvider,
  type PiPlayerRuntime,
  type PiPlayerSession,
} from "../../../../src/agents/pi/pi-action-provider";
import { createPiOutputObserver } from "../../../../src/adapters/pi/pi-output";
import { createAgentConsoleSink } from "../../../../src/adapters/console/agent-console-presenter";
import type {
  PiPromptOptions,
  PiPromptResult,
  PiSessionOptions,
} from "../../../../src/adapters/pi";
import { COMPONENT, Phase, type ActionRequest, type ToolCall } from "../../../../src/domain";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import type { SessionRecordManager } from "../../../../src/recording/session/recorder";
import type { ReplayRecordPlayerRoundInput } from "../../../../src/recording/contracts";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";

const emptyTrace = (): PiPromptResult<ToolCall> => ({
  finalAction: null,
  assistantText: "",
  thinkingText: "",
  toolCalls: [],
  events: [],
});
function request(actorId = 1): ActionRequest {
  return {
    actorId,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 1,
      stage: "day_speech",
      visible_events: [],
      action_failure_policy: "error",
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
}
class MemorySession implements PiPlayerSession {
  readonly inputs: string[] = [];
  trace = emptyTrace();
  closed = false;
  constructor(
    readonly handler: (
      text: string,
      options: PiPromptOptions<ToolCall>,
      session: MemorySession,
    ) => Promise<void>,
    readonly closeError?: Error,
  ) {}
  async prompt<T>(text: string, options: PiPromptOptions<T>): Promise<PiPromptResult<T>> {
    this.inputs.push(text);
    this.trace = emptyTrace();
    await this.handler(text, options as PiPromptOptions<ToolCall>, this);
    return this.trace as PiPromptResult<T>;
  }
  takeTrace<T>(): PiPromptResult<T> {
    return this.trace as PiPromptResult<T>;
  }
  async close() {
    this.closed = true;
    if (this.closeError) throw this.closeError;
  }
}
function setup(
  handler: ConstructorParameters<typeof MemorySession>[0],
  closeError?: Error,
  printLlmIo = false,
) {
  const game = bootstrapGame(sixPlayerMvpConfig);
  const sessions: MemorySession[] = [],
    configurations: PiSessionOptions[] = [],
    records: ReplayRecordPlayerRoundInput[] = [];
  const runtime: PiPlayerRuntime = {
    async createSession(options) {
      configurations.push(options);
      const session = new MemorySession(handler, closeError);
      sessions.push(session);
      return session;
    },
    async close() {
      await Promise.all(sessions.map((session) => session.close()));
    },
  };
  const provider = new PiActionProvider(game.world, {
    runtime,
    settingsResolver: () => ({}),
    personalityPromptResolver: (req) => `PRIVATE_PERSONALITY_${req.actorId}`,
    boardConfig: sixPlayerMvpConfig,
    printThinking: false,
    printLlmIo,
    maxConcurrentRequests: 1,
  });
  const recorder = {
    recordPlayerRound: (row: ReplayRecordPlayerRoundInput) => records.push(row),
    recordLogicOp: () => {},
  } as unknown as SessionRecordManager;
  return {
    provider,
    game,
    sessions,
    configurations,
    records,
    run: (req: ActionRequest) => runWithSessionRecorder(recorder, () => provider.getAction(req)),
  };
}
async function submit(
  options: PiPromptOptions<ToolCall>,
  turnId = "p1",
  action = "speak",
  args: Record<string, unknown> = { text: "合法发言" },
) {
  return options.onToolCall({
    id: "candidate",
    name: "submit_action",
    args: { turn_id: turnId, action, arguments: args },
    rawArgs: "",
  });
}

describe("Pi 玩家行动窗口", () => {
  test("Pi 原生会话收到与其它传输相同的公开名册，未取名玩家只提供编号与座位", async () => {
    const f = setup(async (_input, options) => {
      await submit(options);
    });
    f.game.world.getComponent(2, COMPONENT.Identity)!.name = "苏茶茶";
    try {
      await f.run(request());
      const system = f.configurations[0]!.systemPrompt;
      expect(system).toContain('{"id":1,"seat":1}');
      expect(system).toContain('{"id":2,"seat":2,"name":"苏茶茶"}');
      expect(system).toContain("工具行动必须使用玩家 ID");
      expect(system).not.toContain("PRIVATE_PERSONALITY_2");
    } finally {
      await f.provider.close();
    }
  });
  test("共用工具协议；回执仅选择且 applied:false，过期turn和第二次提交不能写入", async () => {
    const receipts: unknown[] = [];
    const f = setup(async (_input, options) => {
      receipts.push((await submit(options, "foreign")).toolResult);
      receipts.push((await submit(options)).toolResult);
      receipts.push((await submit(options)).toolResult);
    });
    try {
      const before = f.game.phaseManager.getEvents().length;
      expect(await f.run(request())).toEqual({ name: "speak", args: { text: "合法发言" } });
      expect(receipts).toMatchObject([
        { ok: false, error: "turn_id_mismatch" },
        { ok: true, accepted: true, applied: false },
        { ok: false, error: "turn_not_open_or_session_invalid" },
      ]);
      expect(f.game.phaseManager.getEvents().length).toBe(before);
      expect(f.configurations[0]!.tools.map((tool) => tool.name)).toEqual([
        "get_game_schema",
        "submit_action",
        "report_bug",
      ]);
      expect(f.records[0]!.toolCalls?.map((call) => call.accepted)).toEqual([false, true, false]);
    } finally {
      await f.provider.close();
    }
  });

  test("逐席位会话和可见游标独占，后续轮次不复制旧事件／人格", async () => {
    const f = setup(async (input, options) => {
      const turnId = /turn_id=(p\d+)/.exec(input)?.[1] ?? (input.includes("p2") ? "p2" : "p1");
      await submit(options, turnId);
    });
    try {
      const first = request();
      first.context.visible_events = [
        { seq: 1, type: "speech", payload: { text: "VISIBLE_SEAT_1" } },
      ];
      await f.run(first);
      await f.run(first);
      await f.run(request(2));
      expect(f.sessions).toHaveLength(2);
      expect(f.sessions[0]!.inputs[0]).toContain("VISIBLE_SEAT_1");
      expect(f.sessions[0]!.inputs[1]).not.toContain("VISIBLE_SEAT_1");
      expect(f.configurations[0]!.systemPrompt).toContain("PRIVATE_PERSONALITY_1");
      expect(f.configurations[1]!.systemPrompt).toContain("PRIVATE_PERSONALITY_2");
      expect(f.configurations[1]!.systemPrompt).not.toContain("PRIVATE_PERSONALITY_1");
      expect(f.sessions[1]!.inputs[0]).not.toContain("VISIBLE_SEAT_1");
    } finally {
      await f.provider.close();
    }
  });

  test("真实每次输入与完整长思考均录制，printThinking=false不丢内容", async () => {
    const thought = "思考🙂".repeat(4001);
    const f = setup(async (_input, options, session) => {
      session.trace.thinkingText = thought;
      if (session.inputs.length === 2) await submit(options);
    });
    try {
      await f.run(request());
      expect(f.sessions[0]!.inputs).toHaveLength(2);
      const deltas = f.records[0]!.deltaMessages!;
      expect(
        deltas.filter((delta) => delta.role === "user").map((delta) => [delta.kind, delta.content]),
      ).toEqual([
        ["prompt", f.sessions[0]!.inputs[0]],
        ["retry_prompt", f.sessions[0]!.inputs[1]],
      ]);
      expect(
        deltas
          .filter((delta) => delta.name === "thinking")
          .map((delta) => delta.content)
          .join(""),
      ).toBe(thought + thought);
      expect(deltas.every((delta) => (delta.content?.length ?? 0) <= 8000)).toBe(true);
    } finally {
      await f.provider.close();
    }
  });

  test("第二轮显示在模型调用前失败，不把上一轮trace伪造成新输出", async () => {
    const f = setup(
      async (_input, options, session) => {
        session.trace.thinkingText = "ONLY_FIRST_TURN_THOUGHT";
        await submit(options);
      },
      undefined,
      true,
    );
    let broken = false;
    const displayError = new Error("display_preflight_failed");
    const spy = spyOn(console, "log").mockImplementation(() => {
      if (broken) throw displayError;
    });
    try {
      await f.run(request());
      broken = true;
      await expect(f.run(request())).rejects.toThrow("action_turn_failed");
      expect(f.sessions[0]!.inputs).toHaveLength(1);
      expect(f.records).toHaveLength(2);
      expect(f.records[1]!.llmRequestMessages).toEqual([]);
      expect(f.records[1]!.deltaMessages!.filter((row) => row.name === "thinking")).toEqual([]);
      expect(f.records[1]!.deltaMessages!.some((row) => row.kind === "request_error")).toBe(true);
    } finally {
      spy.mockRestore();
      await f.provider.close();
    }
  });

  test("原生schema三次拒绝立即封窗，不能靠第四个合法候选恢复", async () => {
    const results: unknown[] = [];
    const f = setup(async (_input, options) => {
      for (let index = 0; index < 3; index++)
        results.push(
          await options.onInvalidToolCall?.({
            id: `bad-${index}`,
            name: "submit_action",
            args: { turn_id: "p1" },
            rawArgs: "",
          }),
        );
      results.push((await submit(options)).toolResult);
    });
    try {
      await expect(f.run(request())).rejects.toThrow("action_turn_failed");
      expect(results).toEqual([
        { stop: false },
        { stop: false },
        { stop: true },
        expect.objectContaining({ ok: false, error: "turn_invalid_action_limit" }),
      ]);
      expect(f.records[0]!.finalAction).toBeNull();
      expect(f.sessions[0]!.inputs).toHaveLength(1);
    } finally {
      await f.provider.close();
    }
  });

  test("严格可选窗口区分主动等待与外来turn提交失败", async () => {
    for (const invalid of [false, true]) {
      const f = setup(async (_input, options) => {
        if (invalid) await submit(options, "foreign");
      });
      const optional = request();
      optional.context.turn_constraints = { min_valid_actions: 0, max_valid_actions: 1 };
      try {
        if (invalid) await expect(f.run(optional)).rejects.toThrow("action_turn_failed");
        else expect(await f.run(optional)).toBeNull();
        expect(f.records[0]!.finalAction).toBeNull();
        expect(f.sessions[0]!.inputs).toHaveLength(invalid ? 3 : 1);
        if (invalid) {
          for (const input of f.sessions[0]!.inputs.slice(1)) {
            expect(input).toContain("本轮是可选窗口");
            expect(input).toContain("不能当作合法等待");
            expect(input).not.toContain("请立即提交行动");
          }
        }
      } finally {
        await f.provider.close();
      }
    }
  });

  test("模型失败与关闭失败仍录制真实前缀，并保留两份错误", async () => {
    const primary = new Error("model_failed"),
      cleanup = new Error("close_failed");
    const f = setup(async (_input, _options, session) => {
      session.trace.thinkingText = "失败前的真实思考";
      throw primary;
    }, cleanup);
    const error = await f.run(request()).catch((error) => error);
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors).toEqual([primary, cleanup]);
    expect(f.records).toHaveLength(1);
    expect(f.records[0]!.deltaMessages).toContainEqual({
      role: "assistant",
      kind: "assistant_output",
      content: "失败前的真实思考",
      name: "thinking",
    });
    expect(f.provider.runtimeState.scheduler.active).toBe(0);
    await expect(f.provider.close()).rejects.toThrow("pi_provider_close_failed");
  });

  test("截止撤权后等实际传输收尾，排队请求不提前接手槽位", async () => {
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const settled = new Promise<void>((resolve) => {
      release = resolve;
    });
    let lateReceipt: unknown;
    const f = setup(async (_input, options) => {
      entered();
      await new Promise<void>((resolve) =>
        options.signal!.addEventListener("abort", () => resolve(), { once: true }),
      );
      lateReceipt = (await submit(options)).toolResult;
      await settled;
      throw options.signal!.reason;
    });
    const first = request();
    first.deadlineAtMs = Date.now() + 40;
    const pending = f.run(first).catch((error) => error);
    await started;
    await new Promise((resolve) => setTimeout(resolve, 65));
    expect(lateReceipt).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
    expect(f.provider.runtimeState.scheduler.active).toBe(1);
    expect(f.provider.runtimeState.turns).toBe(1);
    release();
    expect(await pending).toBeInstanceOf(Error);
    expect(f.provider.runtimeState.scheduler.active).toBe(0);
    expect(f.sessions[0]!.closed).toBe(true);
    await f.provider.close();
  });
});

for (const io of [false, true])
  for (const thinking of [false, true])
    test(`Pi终端开关 io=${io}/thinking=${thinking} 聚合增量且遵循公共展示约定`, () => {
      const logs: string[] = [];
      const spy = spyOn(console, "log").mockImplementation((line) => {
        logs.push(String(line));
      });
      try {
        const presenter = createPiOutputObserver(
          { transport: "pi", playerId: 1 },
          createAgentConsoleSink({
            printLlmIo: io,
            printThinking: thinking,
            trace: false,
            locale: "en",
            color: false,
          }),
        );
        for (const type of ["thinking", "message"] as const) {
          presenter.update({ type, text: "前", partial: true, blockId: type });
          presenter.update({ type, text: "后", partial: true, blockId: type });
          presenter.update({ type, text: "", partial: false, blockId: type });
        }
        presenter.update({ type: "tool_start", id: "one", name: "submit_action", args: {} });
        presenter.update({
          type: "tool_end",
          id: "one",
          name: "submit_action",
          result: { ok: true },
          isError: false,
        });
        presenter.flush();
        expect(logs.filter((line) => line.includes("[thought]")).length).toBe(thinking ? 1 : 0);
        expect(logs.filter((line) => line.includes("[message]")).length).toBe(
          io || thinking ? 1 : 0,
        );
        expect(logs.filter((line) => line.includes("[tool]")).length).toBe(thinking ? 1 : 0);
        expect(logs.every((line) => !line.includes("前") || line.includes("前后"))).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });
