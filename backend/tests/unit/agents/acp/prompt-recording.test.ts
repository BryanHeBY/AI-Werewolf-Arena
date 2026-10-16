/**
 * 单元测试用真实 ACP provider 与内存 MCP 回合核对实际输入；输入为可见事件与失败工厂。
 * 预期来自实际传入会话的字符串和明确未派发的反例；不启动外部进程或模型。
 */
import { expect, spyOn, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { AcpActionProvider } from "../../../../src/agents/acp/acp-action-provider";
import { PlayerRoundRecorder } from "../../../../src/app/player-round-recorder";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { speakRequest } from "../../../support/builders/agents/acp-requests";
import { ReplaySessionAggregate } from "../../../../src/recording/session/aggregate";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import type { SessionRecordManager } from "../../../../src/recording/session/recorder";

test("ACP round recording retains the exact event batch and turn input actually sent", async () => {
  const sent: string[] = [];
  const record = spyOn(PlayerRoundRecorder.prototype, "record").mockImplementation(() => {});
  const provider = new AcpActionProvider(bootstrapGame(sixPlayerMvpConfig).world, {
    turnTimeoutMs: 1000,
    sessionFactory: {
      async createSession(input) {
        return {
          sessionId: "recording-session",
          async prompt(prompt) {
            sent.push(prompt);
            const turnId = /当前回合 ID：(\S+)/.exec(prompt)![1]!;
            input.registry.submitAction("recording-session", {
              turn_id: turnId,
              action: "speak",
              arguments: { text: "请继续。" },
            });
          },
          async cancel() {},
          async close() {},
        };
      },
    },
  });

  try {
    const first = speakRequest();
    first.context.visible_events = [
      { seq: 1, type: "day_speech", payload: { actorId: 2, text: "UNIQUE_VISIBLE_MARKER" } },
    ];
    await provider.getAction(first);
    await provider.getAction(first);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toContain("UNIQUE_VISIBLE_MARKER");
    expect(sent[1]).not.toContain("UNIQUE_VISIBLE_MARKER");
    for (const [index, call] of record.mock.calls.entries()) {
      const prompt = call[1];
      expect(prompt.userPrompt).toBe(sent[index]);
      expect(prompt.messages.at(-1)?.content).toBe(sent[index]);
      expect(prompt.requestMessages).toEqual([{ role: "user", content: sent[index] }]);
    }
    expect(record).toHaveBeenCalledTimes(2);
  } finally {
    await provider.close();
    record.mockRestore();
  }
});

for (const failure of ["create", "expired"] as const)
  test(`ACP ${failure}: a round that never reaches session.prompt records no dispatched input`, async () => {
    const record = spyOn(PlayerRoundRecorder.prototype, "record").mockImplementation(() => {});
    let creates = 0;
    const provider = new AcpActionProvider(bootstrapGame(sixPlayerMvpConfig).world, {
      turnTimeoutMs: 1000,
      sessionFactory: {
        async createSession() {
          creates++;
          throw new Error("synthetic-create-failure");
        },
      },
      privilegedFallbackProvider: {
        async getAction() {
          return null;
        },
      },
    });
    try {
      const req = speakRequest();
      if (failure === "expired") req.deadlineAtMs = Date.now() - 1;
      expect(await provider.getAction(req)).toBeNull();
      expect(creates).toBe(failure === "create" ? 1 : 0);
      expect(record).toHaveBeenCalledTimes(1);
      const prompt = record.mock.calls[0]![1];
      expect(prompt.requestMessages).toEqual([]);
      expect(prompt.messages.filter((message) => message.role === "user")).toEqual([]);
      expect(prompt.auditMetadata?.join(" ")).toContain("prompt_dispatched=false");
    } finally {
      await provider.close();
      record.mockRestore();
    }
  });

test("ACP long input survives the real player archive message limit without splitting Unicode", async () => {
  let sent = "";
  const aggregate = new ReplaySessionAggregate({
    sessionId: "prompt-chunks",
    board: "six_player_mvp",
    startedAtIso: "2026-10-16T00:00:00.000Z",
  });
  // 会话上下文只替代持久化外壳；真实轮次记录器和聚合器执行原消息归档流程。
  const recorder = {
    recordPlayerRound: aggregate.recordPlayerRound.bind(aggregate),
    recordLogicOp() {},
  } as unknown as SessionRecordManager;
  const provider = new AcpActionProvider(bootstrapGame(sixPlayerMvpConfig).world, {
    turnTimeoutMs: 1000,
    sessionFactory: {
      async createSession(input) {
        return {
          sessionId: "long-input",
          async prompt(prompt) {
            sent = prompt;
            input.registry.submitAction("long-input", {
              turn_id: /当前回合 ID：(\S+)/.exec(prompt)![1]!,
              action: "speak",
              arguments: { text: "收到。" },
            });
          },
          async cancel() {},
          async close() {},
        };
      },
    },
  });
  try {
    const req = speakRequest();
    req.context.visible_events = [
      {
        seq: 1,
        type: "day_speech",
        payload: { actorId: 2, text: "😀".repeat(9000) + "LONG_INPUT_TAIL" },
      },
    ];
    await runWithSessionRecorder(recorder, () => provider.getAction(req));
    const entry = aggregate.normalizedPlayerView(1)!.timeline.find((item) => item.kind === "turn")!;
    if (entry.kind !== "turn") throw new Error("turn_expected");
    const chunks = entry.delta_messages.filter((message) => message.kind === "prompt");
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.map((message) => message.content).join("")).toBe(sent);
    for (const chunk of chunks) {
      expect(chunk.content!.length).toBeLessThanOrEqual(8000);
      expect(chunk.content).not.toMatch(/[\uD800-\uDBFF]$/);
      expect(chunk.content).not.toMatch(/^[\uDC00-\uDFFF]/);
    }
  } finally {
    await provider.close();
  }
});
