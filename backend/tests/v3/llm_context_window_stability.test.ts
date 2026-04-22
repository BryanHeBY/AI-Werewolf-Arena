import { bootstrapGame } from "../../src/app/bootstrap";
import { LlmActionProvider } from "../../src/ai/agents/llm/llm_action_provider";
import { Phase } from "../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";

class RepeatSpeakToolLoopClient {
  public lastMessages: Array<{ role: string; content: string }> = [];

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
      id: "speak_1",
      name: "speak",
      args: { text: "持续发言" },
      rawArgs: "{\"text\":\"持续发言\"}",
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "ok",
    };
  }
}

describe("llm context window stability", () => {
  test("should keep message window bounded after many turns", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new RepeatSpeakToolLoopClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      maxPromptEvents: 2,
    });

    for (let i = 1; i <= 18; i++) {
      const feed = Array.from({ length: i }, (_, idx) => `marker-${idx + 1}`);
      const action = await provider.getAction({
        phase: Phase.Day,
        actorId: 1,
        allowedTools: ["speak"],
        context: {
          day: Math.floor((i - 1) / 6) + 1,
          phase: "day_speech",
          must_act: true,
          broadcast_feed: feed,
        },
      });
      expect(action).toEqual({
        name: "speak",
        args: { text: "持续发言" },
      });
    }

    expect(client.lastMessages.length).toBeLessThanOrEqual(14);
    const merged = client.lastMessages.map((item) => item.content).join("\n");
    expect(merged).toContain("【广播】marker-18");
    expect(merged).not.toMatch(/【广播】marker-1(\n|$)/);
  });
});
