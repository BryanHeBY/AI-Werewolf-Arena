import { describe, expect, test } from "bun:test";
import { AcpActionProvider } from "../../../src/ai/agents/acp/acp_action_provider";
import { AcpSessionFactory } from "../../../src/ai/integrations/acp/session";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ActionRequest, Phase } from "../../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

function request(deadlineAtMs: number): ActionRequest {
  return {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    deadlineAtMs,
    context: {turn_constraints: {},
      day: 1,
      stage: "day_speech",
      visible_events: [],
    },
  };
}

describe("AcpActionProvider session lifecycle", () => {
  test("falls back when session initialization never resolves", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const factory: AcpSessionFactory = {
      createSession(input): Promise<never> {
        return new Promise((_, reject) => input.signal!.addEventListener("abort", () => reject(input.signal!.reason), { once: true }));
      },
    };
    const provider = new AcpActionProvider(context.world, {
      sessionFactory: factory,
      fallbackProvider: {
        async getAction() {
          return { name: "speak", args: { text: "超时回退" } };
        },
      },
      turnTimeoutMs: 50,
    });

    const startedAt = Date.now();
    await expect(provider.getAction(request(Date.now() + 50))).resolves.toEqual({
      name: "speak",
      args: { text: "超时回退" },
    });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    await provider.close();
  });
});
