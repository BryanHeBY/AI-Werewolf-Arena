/**
 * Complete Guard policy Tape scenarios verify A/no-action/A repeat semantics across night boundaries.
 * Input: Explicit repeat policies, fixed scripts and real phase-manager requests.
 * Output and independent oracle: Manual permitted/refused guard actions and strict replay of original policy decisions.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  createRandom,
  Phase,
  Role,
  WinCondition,
  type ActionRequest,
  type ActionProvider,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/runtime/simulation/reproduction_context";
import { GameEventRecorder } from "../../../../src/runtime/game_event_recorder";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

for (const repeatPolicy of ["awa_last_action_v1", "netease_consecutive_nights_v1"] as const)
  test(`${repeatPolicy}: A, no-action, A semantic branch reproduces through the actual Tape`, async () => {
    const root = await createTestTempDirectory("awa-guard-branch-record-");
    const output = await createTestTempDirectory("awa-guard-branch-replay-");
    const config = {
      ...sixPlayerMvpConfig,
      guard: { repeatPolicy },
      winConditions: [WinCondition.SlaughterCity],
    };
    const game = bootstrapGame(config, {
      random: createRandom("guard-branch"),
      fixedRoles: [Role.Guard, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer],
    });
    const manager = await SessionRecordManager.create(
      {
        sessionId: "guard-branch",
        board: "guard_branch",
        startedAtIso: "2026-10-09T00:00:00.000Z",
      },
      root,
    );
    const trace = beginGameReproduction(manager, game, {
      engine: await currentEngineVersion(),
      boardId: "guard_branch",
      ...(void config, {}),
      locale: "zh-CN",
      maxDays: 3,
    });
    const actions: ActionProvider = {
      async getAction(request) {
        if (request.allowedTools.includes("guard"))
          return request.context.day === 2
            ? null
            : { name: "guard", args: { target_id: 4, abstain: false } };
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: null, abstain: true } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 4 } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: null, abstain: true } };
        throw new Error(`Unexpected offline stage ${request.context.stage}`);
      },
    };
    const provider = { getAction: (request: ActionRequest) => trace.decide(request, actions) };
    const recorder = new GameEventRecorder(
      { world: game.world, replayManager: manager },
      Phase.Night,
    );
    await runWithSessionRecorder(manager, async () => {
      let cycle = 0;
      while (!game.phaseManager.getSnapshot().gameOver) {
        await game.phaseManager.runSingleCycle(provider, 3);
        trace.checkpoint(
          captureCheckpoint(
            game.world,
            game.phaseManager.getSnapshot(),
            ++cycle,
            true,
            game.phaseManager.getEvents().length,
          ),
          game.phaseManager.getEvents(),
        );
        recorder.flush(game.phaseManager.getEvents());
      }
      const snapshot = game.phaseManager.getSnapshot();
      await manager.finalize({
        endedAtIso: "2026-10-09T00:01:00.000Z",
        winner: snapshot.result?.winner ?? null,
        ...(snapshot.result ? { gameResult: snapshot.result } : {}),
        finishReason: snapshot.result?.reason ?? "completed",
        players: captureCheckpoint(game.world, snapshot, cycle, true, 0).players.map((player) => ({
          player_id: player.id,
          role: player.role,
          camp: player.camp,
          alive: player.alive,
        })),
      });
    });
    const record = await readReproduction(path.join(root, "guard-branch/reproduction.json"));
    expect(record.metadata.normalizedBoard.guard).toEqual({ repeatPolicy });
    const guards = record.events.filter((event) => event.type === "guard_applied");
    expect(guards.map((event) => event.payload.targetId)).toEqual(
      repeatPolicy === "netease_consecutive_nights_v1" ? [4, 4] : [4],
    );
    expect(
      record.decisions
        .filter((decision) => decision.request.allowedTools.includes("guard"))
        .map((decision) => decision.request.context.day),
    ).toEqual([1, 2, 3]);
    const before = JSON.stringify(record);
    const replayed = await replayReproduction(record, output);
    expect(replayed.snapshot).toEqual(game.phaseManager.getSnapshot());
    expect(replayed.eventCount).toBe(record.events.length);
    expect(replayed.decisionCount).toBe(record.decisions.length);
    expect(JSON.stringify(record)).toBe(before);
  });
