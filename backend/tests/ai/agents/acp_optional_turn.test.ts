import { ActionWindow } from "../../../src/core";
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { AcpActionProvider } from "../../../src/ai/agents/acp/acp_action_provider";
import { Phase, type ActionRequest } from "../../../src/core";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../support/temp_directory";

for (const required of [false, true]) test(`successful ACP prompt with no tool submission ${required ? "falls back for a required turn" : "honors an optional pass"}`, async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig);
  let fallbacks = 0, closes = 0;
  const provider = new AcpActionProvider(world, {
    sessionFactory: { async createSession() { return { sessionId: "optional", async prompt() {}, async cancel() {}, async close() { closes++; } }; } },
    fallbackProvider: { async getAction() { fallbacks++; return { name: "self_destruct", args: { reason: "must not be automatic", confirm: true } }; } },
  });
  const root = await createTestTempDirectory("awa-optional-acp-");
  const manager = await SessionRecordManager.create({ sessionId: "optional", board: "synthetic", startedAtIso: "2026-10-08T00:00:00.000Z" }, root);
  const request: ActionRequest = { actorId: 1, phase: Phase.Day, allowedTools: ["self_destruct"], context: { day: 1, stage: ActionWindow.OnPreVote, visible_events: [], turn_constraints: { min_valid_actions: required ? 1 : 0, max_valid_actions: 1 } } };
  await runWithSessionRecorder(manager, async () => {
    const action = await provider.getAction(request); expect(required ? action?.name : action).toBe(required ? "self_destruct" : null);
    await provider.close(); await manager.finalize({ endedAtIso: "2026-10-08T00:01:00.000Z", winner: null, finishReason: "completed", players: [] });
  });
  expect(fallbacks).toBe(required ? 1 : 0); expect(closes).toBe(1);
  const view = JSON.parse(await fs.readFile(path.join(root, "optional/players/player_1.json"), "utf8"));
  expect(view.timeline[0].delta_messages.some((message: any) => message.kind === "fallback")).toBe(required);
});
