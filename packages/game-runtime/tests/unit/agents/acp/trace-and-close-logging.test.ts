/**
 * 单元测试验证 trace-and-close-logging 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { expect, spyOn, test } from "bun:test";
import { text } from "@ai-werewolf-arena/game-text";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { Phase, type ActionRequest } from "../../../../src/domain";

const request: ActionRequest = {
  actorId: 1,
  phase: Phase.Day,
  allowedTools: ["speak"],
  context: {
    day: 1,
    stage: "day_speech",
    visible_events: [],
    turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
  },
};

test("ACP trace is independent of payload flags and retains safe display diagnostics", async () => {
  const { AcpActionProvider } = await import("../../../../src/agents/acp/acp-action-provider");
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" }),
    lines: string[] = [];
  const log = spyOn(console, "log").mockImplementation((...values) => {
    lines.push(values.join(" "));
  });
  const error = Object.assign(new Error("synthetic-private-error-body"), { statusCode: 429 });
  const provider = new AcpActionProvider(game.world, {
    trace: true,
    displayLocale: "zh-CN",
    printLlmIo: false,
    printThinking: false,
    turnTimeoutMs: 1000,
    sessionFactory: {
      async createSession() {
        throw error;
      },
    },
    privilegedFallbackProvider: {
      async getAction() {
        return null;
      },
    },
  });
  try {
    expect(await provider.getAction(request)).toBeNull();
    expect(lines.join("\n")).toContain("[ACPActionProvider]");
    expect(lines.join("\n")).not.toContain("prompt_start");
    expect(lines.join("\n")).not.toContain(error.message);
  } finally {
    log.mockRestore();
    await provider.close();
  }
});

for (const trigger of [
  "request_start",
  "prompt_system",
  "prompt_user",
  "request_ok",
  "request_recovered",
  "request_transport_fail",
] as const)
  test(`ACP logging close at ${trigger} suppresses late actions and private round writes`, async () => {
    const { AcpActionProvider } = await import("../../../../src/agents/acp/acp-action-provider");
    const { PlayerRoundRecorder } = await import("../../../../src/app/player-round-recorder");
    let closing: Promise<void> | undefined,
      creates = 0,
      prompts = 0,
      fallbacks = 0;
    const record = spyOn(PlayerRoundRecorder.prototype, "record").mockImplementation(() => {});
    const provider = new AcpActionProvider(
      bootstrapGame(sixPlayerMvpConfig, { locale: "en" }).world,
      {
        trace: true,
        printLlmIo: true,
        displayLocale: "en",
        turnTimeoutMs: 1000,
        sessionFactory: {
          async createSession(input) {
            creates++;
            if (trigger === "request_transport_fail" || trigger === "request_recovered")
              throw new Error("synthetic-model-failure");
            return {
              sessionId: "logging-close",
              async prompt(prompt) {
                prompts++;
                const turn = /Current turn ID: (t\d+)/.exec(prompt)![1];
                input.registry.submitAction("logging-close", {
                  turn_id: turn,
                  action: "speak",
                  arguments: { text: "late" },
                });
              },
              async cancel() {},
              async close() {},
            };
          },
        },
        privilegedFallbackProvider: {
          async getAction() {
            fallbacks++;
            return { name: "speak", args: { text: "fallback" } };
          },
        },
      },
    );
    const log = spyOn(console, "log").mockImplementation((...values) => {
      if (values.join(" ").includes(trigger)) closing ??= provider.close();
    });
    try {
      expect(await provider.getAction(request)).toBeNull();
      await closing;
      expect(record).not.toHaveBeenCalled();
      expect(provider.runtimeState.turns).toBe(0);
      expect(provider.runtimeState.pool).toEqual({
        closed: true,
        sessions: 0,
        creating: 0,
        retiring: 0,
      });
      if (trigger === "request_start" || trigger === "prompt_system") expect(creates).toBe(0);
      if (trigger === "prompt_user") expect(prompts).toBe(0);
      expect(fallbacks).toBe(trigger === "request_recovered" ? 1 : 0);
    } finally {
      log.mockRestore();
      record.mockRestore();
      await provider.close();
    }
  });
