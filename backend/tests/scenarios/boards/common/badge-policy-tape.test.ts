/**
 * Complete badge Tape scenarios verify actual deceased-holder badge choice and reproduction.
 * Input: Fixed scripts, original deaths/holder choices and scoped checkpoints.
 * Output and independent oracle: Independent successor/destruction outcomes and exact strict replay of badge decisions.
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

for (const choice of [false, true])
  test(`${choice}: actual badge death selection reproduces through strict Tape`, async () => {
    const root = await createTestTempDirectory("awa-badge-branch-record-");
    const output = await createTestTempDirectory("awa-badge-branch-replay-");
    const config = {
      ...sixPlayerMvpConfig,
      enableSheriff: true,
      initialSheriffSeat: 4,
      sheriff: {
        voteWeight: 2.25,
        badgePolicy: choice ? ("awa_holder_choice_v1" as const) : ("awa_next_seat_v1" as const),
      },
      winConditions: [WinCondition.SlaughterCity],
    };
    const game = bootstrapGame(config, {
      random: createRandom("badge-branch"),
      fixedRoles: [Role.Guard, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer],
    });
    const manager = await SessionRecordManager.create(
      {
        sessionId: "badge-branch",
        board: "badge_branch",
        startedAtIso: "2026-10-09T00:00:00.000Z",
      },
      root,
    );
    const trace = beginGameReproduction(manager, game, {
      engine: await currentEngineVersion(),
      boardId: "badge_branch",
      ...(void config, {}),
      locale: "zh-CN",
      maxDays: 2,
    });
    const actions: ActionProvider = {
      async getAction(request) {
        if (request.allowedTools.includes("choose_badge_successor"))
          return { name: "choose_badge_successor", args: { target_id: 5 } };
        if (request.allowedTools.includes("choose_direction"))
          return { name: "choose_direction", args: { direction: "clockwise" } };
        if (request.allowedTools.includes("guard"))
          return {
            name: "guard",
            args: { target_id: request.context.day === 1 ? 6 : 5, abstain: false },
          };
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return {
            name: "kill_vote",
            args: {
              target_id: request.context.day === 1 ? 4 : null,
              abstain: request.context.day !== 1,
            },
          };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 5 } };
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
        await game.phaseManager.runSingleCycle(provider, 2);
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
    const record = await readReproduction(path.join(root, "badge-branch/reproduction.json"));
    expect(record.metadata.normalizedBoard.sheriff).toEqual(config.sheriff);
    expect(
      record.decisions.filter(
        (decision) => decision.request.context.stage === "sheriff_badge_choice",
      ),
    ).toHaveLength(choice ? 1 : 0);
    expect(
      record.events
        .filter((event) => event.type === "sheriff_badge_transferred")
        .map((event) => event.payload.toId),
    ).toEqual([choice ? 5 : 1]);
    if (choice)
      expect(
        record.checkpoints.at(-1)?.players.find((player) => player.id === 5)?.badge.handoffPolicy,
      ).toBe("awa_holder_choice_v1");
    const before = JSON.stringify(record);
    const replayed = await replayReproduction(record, output);
    expect(replayed.snapshot).toEqual(game.phaseManager.getSnapshot());
    expect(replayed.eventCount).toBe(record.events.length);
    expect(replayed.decisionCount).toBe(record.decisions.length);
    expect(JSON.stringify(record)).toBe(before);
  });
