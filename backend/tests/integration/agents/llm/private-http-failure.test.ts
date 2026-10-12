/**
 * SDK HTTP integration test verifies actual installed-client authentication failure produces safe terminal and private replay diagnostics.
 * Input: Original local synthetic HTTP response, fake authentication canary and actual temporary player record scope.
 * Output and oracle: Exact one-request policy, original fallback and literal safe status/code assertions remain unchanged; no remote model or real credential is involved.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { AiSdkClient } from "../../../../src/ai/integrations/llm/ai_sdk_client";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { Phase, type ActionRequest } from "../../../../src/core";

const secret = "synthetic-private-transport-canary";

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

const fallback = { name: "speak" as const, args: { text: "Original 茶茶 fallback" } };

test("actual installed SDK HTTP error metadata is safe in private replay and terminal diagnostics", async () => {
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      requests++;
      return Response.json(
        { error: { message: secret, type: "invalid_api_key", code: "invalid_api_key" } },
        { status: 401, headers: { authorization: secret } },
      );
    },
  });
  const root = await createTestTempDirectory("awa-sdk-error-");
  const { world } = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  const manager = await SessionRecordManager.create(
    {
      sessionId: "http",
      locale: "en",
      board: "synthetic",
      startedAtIso: "2026-10-08T00:00:00.000Z",
    },
    root,
  );
  const client = new AiSdkClient({
    apiKey: secret,
    providerName: "synthetic",
    baseURL: `${server.url.origin}/v1`,
    model: "synthetic",
  });
  const provider = LlmActionProvider.fromModelClient(world, client, {
    fallbackProvider: {
      async getAction() {
        return fallback;
      },
    },
    trace: true,
    llmTimeoutMs: 2000,
  });
  const lines: string[] = [];
  const original = console.log;
  console.log = (...values) => {
    lines.push(values.join(" "));
  };
  try {
    await runWithSessionRecorder(manager, async () => {
      expect(await provider.getAction(request)).toEqual(fallback);
      await manager.finalize({
        endedAtIso: "2026-10-08T00:01:00.000Z",
        winner: null,
        finishReason: "completed",
        players: [],
      });
    });
    expect(requests).toBe(1); // Non-retryable 401 still follows the installed SDK policy.
    const raw = await fs.readFile(path.join(root, "http/players/player_1.json"), "utf8");
    expect(raw).not.toContain(secret);
    expect(lines.join("\n")).not.toContain(secret);
    expect(raw).toContain('"authentication_failed"');
    expect(raw).toContain('"statusCode": 401');
    expect(lines.join("\n")).toContain("rejected authentication");
  } finally {
    console.log = original;
    server.stop(true);
  }
});
