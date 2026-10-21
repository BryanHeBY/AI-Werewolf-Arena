/**
 * 单元测试验证 acp-action-provider-lifecycle 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { describe, expect, test } from "bun:test";
import { AcpActionProvider } from "../../../src/agents/acp/acp-action-provider";
import { AcpSessionFactory } from "../../../src/adapters/acp/session";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ActionRequest, Phase } from "../../../src/domain/model";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

function request(deadlineAtMs: number): ActionRequest {
  return {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    deadlineAtMs,
    context: { turn_constraints: {}, day: 1, stage: "day_speech", visible_events: [] },
  };
}

describe("AcpActionProvider session lifecycle", () => {
  test("选择 Promise 先兑现时仍给普通 MCP 接受回执送达机会，再取消会话", async () => {
    let delivered = false,
      cancelledBeforeDelivery = false;
    const provider = new AcpActionProvider(bootstrapGame(sixPlayerMvpConfig).world, {
      turnTimeoutMs: 1000,
      sessionFactory: {
        async createSession(input) {
          return {
            sessionId: "receipt-before-cancel",
            async prompt(prompt) {
              await input.registry.submitActionWithFeedback("receipt-before-cancel", {
                turn_id: /当前回合 ID：(\S+)/.exec(prompt)![1]!,
                action: "speak",
                arguments: { text: "收到。" },
              });
              await new Promise((resolve) => setTimeout(resolve, 10));
              delivered = true;
            },
            async cancel() {
              cancelledBeforeDelivery ||= !delivered;
            },
            async close() {},
          };
        },
      },
    });
    try {
      expect(await provider.getAction(request(Date.now() + 1000))).toEqual({
        name: "speak",
        args: { text: "收到。" },
      });
      expect(delivered).toBe(true);
      expect(cancelledBeforeDelivery).toBe(false);
    } finally {
      await provider.close();
    }
  });
  test("an initialization deadline closes the turn without starting a late fallback", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const factory: AcpSessionFactory = {
      createSession(input): Promise<never> {
        return new Promise((_, reject) =>
          input.signal!.addEventListener("abort", () => reject(input.signal!.reason), {
            once: true,
          }),
        );
      },
    };
    let fallbackCalls = 0;
    const provider = new AcpActionProvider(context.world, {
      sessionFactory: factory,
      privilegedFallbackProvider: {
        async getAction() {
          fallbackCalls++;
          return { name: "speak", args: { text: "超时回退" } };
        },
      },
      turnTimeoutMs: 50,
    });

    const startedAt = Date.now();
    await expect(provider.getAction(request(Date.now() + 50))).resolves.toBeNull();
    expect(fallbackCalls).toBe(0);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    await provider.close();
  });
});
