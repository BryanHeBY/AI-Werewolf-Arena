/**
 * Unit tests verify ACP session-bound tool submission, prompt deltas and immediate required-turn fallback through inert sessions.
 * Input: Original callback factories, fresh worlds and literal speak requests under the same AcpActionProvider describe prefix.
 * Output and oracle: Exact submission receipts, session reuse/cancel counts, persona text and fallback timing remain the original assertions; no listener, child process or file recorder runs.
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { AcpActionProvider } from "../../../../src/ai/agents/acp/acp_action_provider";
import { AcpSession, AcpSessionFactory } from "../../../../src/ai/integrations/acp/session";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
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
        expect(input.initialPrompt).toContain("你的唯一目标是帮助你所在阵营赢得本局");
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
            expect(prompt).toContain(`参数 turn_id 必须为 ${turnId}`);
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
      fallbackProvider: {
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
