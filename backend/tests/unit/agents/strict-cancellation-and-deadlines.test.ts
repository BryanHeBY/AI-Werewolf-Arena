/**
 * 单元测试验证 strict-cancellation-and-deadlines 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type ActionRequest, type RoleComponent } from "../../../src/core";
import { getGuardState } from "../../../src/game/mechanisms/roles/guard/ports";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../../src/ai/agents/acp/acp_action_provider";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { describeError } from "../../../src/utils/error_diagnostic";

const roles = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager];

const request = (strict: boolean): ActionRequest => ({
  actorId: 5,
  phase: Phase.Night,
  allowedTools: ["guard"],
  context: {
    day: 1,
    stage: "guard",
    visible_events: [],
    turn_constraints: { min_valid_actions: 0, max_valid_actions: 1 },
    ...(strict ? { action_failure_policy: "error" } : {}),
  },
});

for (const transport of ["sdk", "acp"] as const)
  for (const strict of [false, true])
    test(`${transport}/${strict}: owned provider cancellation preserves default behavior and never fakes strict waiting`, async () => {
      const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles });
      let started!: () => void,
        finish!: () => void,
        closes = 0;
      const starting = new Promise<void>((resolve) => {
        started = resolve;
      });
      const client: any = {
        async chat() {
          throw new Error("unexpected_chat");
        },
        async runToolLoop(_m: any, _t: any, _c: any, options: any) {
          started();
          return new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () => reject(options.signal.reason), {
              once: true,
            }),
          );
        },
      };
      const provider =
        transport === "sdk"
          ? new LlmActionProvider(world, client, { llmTimeoutMs: 1500 })
          : new AcpActionProvider(world, {
              turnTimeoutMs: 1500,
              sessionFactory: {
                async createSession() {
                  return {
                    sessionId: "cancel-policy",
                    async prompt() {
                      started();
                      await new Promise<void>((resolve) => {
                        finish = resolve;
                      });
                    },
                    async cancel() {
                      finish?.();
                    },
                    async close() {
                      closes++;
                      finish?.();
                    },
                  };
                },
              },
            });
      const pending = provider.getAction(request(strict)).then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await starting;
      await expect(provider.close()).resolves.toBeUndefined();
      const result = await pending;
      if (strict) {
        expect("error" in result).toBe(true);
        if (!("error" in result)) throw new Error("expected_cancellation");
        expect(describeError(result.error).code).toBe("request_aborted");
      } else expect(result).toEqual({ value: null });
      expect(
        getGuardState(world.getComponent(5, COMPONENT.Role)!)!.lastTarget,
      ).toBeNull();
      expect(provider.runtimeState.turns).toBe(0);
      if (transport === "acp") expect(closes).toBe(1);
    });

for (const transport of ["sdk", "acp"] as const)
  test(`${transport}: a strict deadline cannot be returned as a wait or spend a resource`, async () => {
    const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles });
    let finish!: () => void,
      fallbacks = 0;
    const client: any = {
      async chat() {
        throw new Error("unexpected_chat");
      },
      async runToolLoop(_m: any, _t: any, _c: any, options: any) {
        return new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () => reject(options.signal.reason), {
            once: true,
          }),
        );
      },
    };
    const privilegedFallbackProvider = {
      async getAction() {
        fallbacks++;
        return null;
      },
    };
    const provider =
      transport === "sdk"
        ? new LlmActionProvider(world, client, { llmTimeoutMs: 30, privilegedFallbackProvider })
        : new AcpActionProvider(world, {
            turnTimeoutMs: 30,
            privilegedFallbackProvider,
            sessionFactory: {
              async createSession() {
                return {
                  sessionId: "deadline-policy",
                  async prompt() {
                    await new Promise<void>((resolve) => {
                      finish = resolve;
                    });
                  },
                  async cancel() {
                    finish?.();
                  },
                  async close() {
                    finish?.();
                  },
                };
              },
            },
          });
    try {
      await expect(provider.getAction(request(true))).rejects.toThrow("action_turn_failed");
      expect(fallbacks).toBe(0);
      expect(
        getGuardState(world.getComponent(5, COMPONENT.Role)!)!.lastTarget,
      ).toBeNull();
    } finally {
      await provider.close();
    }
  });

test("strict cancellation does not swallow a real ACP cleanup error", async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles });
  let started!: () => void, finish!: () => void;
  const starting = new Promise<void>((resolve) => {
      started = resolve;
    }),
    cleanupError = new Error("synthetic_cleanup_failure");
  const provider = new AcpActionProvider(world, {
    turnTimeoutMs: 1500,
    sessionFactory: {
      async createSession() {
        return {
          sessionId: "cleanup-policy",
          async prompt() {
            started();
            await new Promise<void>((resolve) => {
              finish = resolve;
            });
          },
          async cancel() {
            finish?.();
          },
          async close() {
            finish?.();
            throw cleanupError;
          },
        };
      },
    },
  });
  const pending = provider.getAction(request(true)).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await starting;
  const closeError = await provider.close().then(
    () => undefined,
    (error) => error,
  );
  expect(closeError).toBeInstanceOf(AggregateError);
  const contains = (error: unknown): boolean =>
    error === cleanupError || (error instanceof AggregateError && error.errors.some(contains));
  expect(contains(closeError)).toBe(true);
  const result = await pending;
  expect("error" in result).toBe(true);
  expect(
    getGuardState(world.getComponent(5, COMPONENT.Role)!)!.lastTarget,
  ).toBeNull();
});

for (const strict of [false, true])
  test(`${strict}: synchronous SDK completion cannot hide an elapsed strict absolute deadline`, async () => {
    const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles });
    const input = request(strict);
    input.deadlineAtMs = Date.now() + 60;
    const client: any = {
      async chat() {
        throw new Error("unexpected_chat");
      },
      async runToolLoop() {
        while (Date.now() <= input.deadlineAtMs! + 5) {
          /* Simulate synchronous decoding before timers can dispatch. */
        }
        return { finalAction: null, assistantText: "End" };
      },
    };
    const provider = new LlmActionProvider(world, client, { llmTimeoutMs: 1500 });
    try {
      if (strict) await expect(provider.getAction(input)).rejects.toThrow("action_turn_failed");
      else expect(await provider.getAction(input)).toBeNull();
      expect(
        getGuardState(world.getComponent(5, COMPONENT.Role)!)!.lastTarget,
      ).toBeNull();
    } finally {
      await provider.close();
    }
  });

for (const transport of ["sdk", "acp"] as const)
  for (const selected of [false, true])
    test(`${transport}/${selected}: synchronous recording after a timely model result cannot deliver a late strict result`, async () => {
      const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles });
      const input = request(true);
      input.deadlineAtMs = Date.now() + 60;
      const outcomes: any[] = [];
      const client: any = {
        async chat() {
          throw new Error("unexpected_chat");
        },
        async runToolLoop(_m: any, _t: any, callbacks: any) {
          if (selected)
            await callbacks.onToolCall({
              name: "submit_action",
              args: { turn_id: "t1", action: "guard", arguments: { target_id: 6, abstain: false } },
            });
          return { finalAction: null, assistantText: "End" };
        },
      };
      const provider =
        transport === "sdk"
          ? new LlmActionProvider(world, client, { llmTimeoutMs: 1500 })
          : new AcpActionProvider(world, {
              turnTimeoutMs: 1500,
              sessionFactory: {
                async createSession(session) {
                  return {
                    sessionId: "late-record",
                    async prompt() {
                      if (selected)
                        session.registry.submitAction("late-record", {
                          turn_id: "t1",
                          action: "guard",
                          arguments: { target_id: 6, abstain: false },
                        });
                    },
                    async cancel() {},
                    async close() {},
                  };
                },
              },
            });
      const recorder =
        transport === "sdk"
          ? (provider as any).orchestrator.options.recorder
          : (provider as any).roundRecorder;
      recorder.record = (_request: any, _prompt: any, outcome: any) => {
        outcomes.push(outcome);
        while (Date.now() <= input.deadlineAtMs! + 5) {
          /* Slow synchronous persistence/serialization. */
        }
      };
      try {
        await expect(provider.getAction(input)).rejects.toThrow("action_turn_failed");
        expect(
          getGuardState(world.getComponent(5, COMPONENT.Role)!)!.lastTarget,
        ).toBeNull();
        expect(
          outcomes.some((outcome) =>
            outcome.retryTrace?.some(
              (trace: any) =>
                trace.reason === "request_timeout" && trace.diagnostic?.code === "request_timeout",
            ),
          ),
        ).toBe(true);
      } finally {
        await provider.close();
      }
    });
