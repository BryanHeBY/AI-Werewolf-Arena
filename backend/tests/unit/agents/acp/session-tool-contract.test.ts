/**
 * 单元测试验证 session-tool-contract 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { AcpActionProvider } from "../../../../src/agents/acp/acp-action-provider";
import { AcpSession, AcpSessionFactory } from "../../../../src/adapters/acp/session";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { speakRequest } from "../../../support/builders/agents/acp-requests";

describe("AcpActionProvider", () => {
  test("accepts an action only through the MCP bridge bound to its session", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    let cancelled = 0;
    let sessionsCreated = 0;
    const prompts: string[] = [];
    const factory: AcpSessionFactory = {
      async createSession(input): Promise<AcpSession> {
        sessionsCreated += 1;
        expect(input.initialPrompt).toContain("争取达成本局规则赋予你的个人胜利目标");
        expect(input.initialPrompt).toContain("你的性格与发言风格要求：先总结事实，再提出问题。");
        expect(input.initialPrompt).not.toContain("MCP 协议");
        expect(input.initialPrompt).not.toContain("werewolf-game");
        expect(input.initialPrompt).not.toContain("speak_to_wolves.text");
        return {
          sessionId: "fake-session-1",
          async prompt(prompt: string): Promise<void> {
            prompts.push(prompt);
            const turnId = /当前回合 ID：(\S+)/.exec(prompt)?.[1];
            expect(turnId).toBeDefined();
            expect(prompt).toContain("MCP 服务 werewolf-game 的 submit_action");
            expect(prompt).toContain(`turn_id 必须为 ${turnId}`);
            const response = input.registry.submitAction("fake-session-1", {
              turn_id: turnId!,
              action: "speak",
              arguments: { text: "这是 MCP 工具提交的行动。" },
            });
            expect(response).toEqual({ ok: true, accepted: true, applied: false, action: "speak" });
          },
          async cancel(): Promise<void> {
            cancelled += 1;
          },
          async close(): Promise<void> {},
        };
      },
    };
    const provider = new AcpActionProvider(context.world, {
      sessionFactory: factory,
      turnTimeoutMs: 1000,
      personalityPromptResolver: () => "先总结事实，再提出问题。",
    });

    await expect(provider.getAction(speakRequest())).resolves.toEqual({
      name: "speak",
      args: { text: "这是 MCP 工具提交的行动。" },
    });
    // 同一 ACP session 会复用，但每一回合由不同的 turn_id 防重放。
    await expect(provider.getAction(speakRequest())).resolves.toEqual({
      name: "speak",
      args: { text: "这是 MCP 工具提交的行动。" },
    });
    expect(sessionsCreated).toBe(1);
    expect(cancelled).toBe(2);
    expect(prompts[0]).toContain('{"events":[[1,"phase_changed",{"day":1,"phase":"day"}]]}');
    expect(prompts[1]).not.toContain('"phase_changed"');
    await provider.close();
  });

  test("falls back as soon as a required ACP turn ends without submit_action", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const factory: AcpSessionFactory = {
      async createSession(): Promise<AcpSession> {
        return {
          sessionId: "empty-session",
          async prompt(): Promise<void> {},
          async cancel(): Promise<void> {},
          async close(): Promise<void> {},
        };
      },
    };
    const provider = new AcpActionProvider(context.world, {
      sessionFactory: factory,
      turnTimeoutMs: 60_000,
      privilegedFallbackProvider: {
        async getAction() {
          return { name: "speak", args: { text: "立即回退。" } };
        },
      },
    });

    const startedAt = Date.now();
    const required = speakRequest();
    required.context.turn_constraints = { min_valid_actions: 1, max_valid_actions: 1 };
    await expect(provider.getAction(required)).resolves.toEqual({
      name: "speak",
      args: { text: "立即回退。" },
    });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    await provider.close();
  });
});
