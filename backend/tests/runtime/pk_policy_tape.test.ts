/**
 * Complete PK policy Tape scenarios verify sheriff and exile election/PK policy combinations.
 * Input: Explicit PK variants, literal action scripts and original recorder checkpoints.
 * Output and independent oracle: Manual nomination/vote/death sequence and exact strict replay of the executed policy.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { bootstrapGame } from "../../src/app/bootstrap";
import {
  createRandom,
  Phase,
  Role,
  WinCondition,
  type ActionRequest,
  type ActionProvider,
} from "../../src/core";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../src/runtime/simulation/reproduction_context";
import { GameEventRecorder } from "../../src/runtime/game_event_recorder";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";

for (const pk of [false, true])
  test(`${pk}: sheriff and exile policies reproduce the actual election and PK Tape`, async () => {
    const root = await createTestTempDirectory("awa-pk-branch-record-");
    const output = await createTestTempDirectory("awa-pk-branch-replay-");
    const config = {
      ...sixPlayerMvpConfig,
      enableSheriff: true,
      sheriff: {
        voteWeight: 1,
        electionPolicy: pk
          ? ("awa_nomination_offstage_pk_v1" as const)
          : ("awa_final_candidates_v1" as const),
      },
      voting: { exilePolicy: pk ? ("awa_one_pk_v1" as const) : ("awa_direct_v1" as const) },
      winConditions: [WinCondition.SlaughterCity],
    };
    const game = bootstrapGame(config, {
      random: createRandom("pk-branch"),
      fixedRoles: [Role.Guard, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer],
    });
    const manager = await SessionRecordManager.create(
      {
        sessionId: "pk-branch",
        board: "pk_branch",
        startedAtIso: "2026-10-09T00:00:00.000Z",
      },
      root,
    );
    const trace = beginGameReproduction(manager, game, {
      engine: await currentEngineVersion(),
      boardId: "pk_branch",
      boardConfig: config,
      locale: "zh-CN",
      maxDays: 2,
    });
    const actions: ActionProvider = {
      async getAction(request) {
        const stage = request.context.stage;
        if (stage === "sheriff_nomination")
          return { name: "run_for_sheriff", args: { run: request.actorId <= 3 } };
        if (stage === "sheriff_withdraw")
          return { name: "run_for_sheriff", args: { run: request.actorId !== 3 } };
        if (stage === "sheriff_vote")
          return {
            name: "vote_for_sheriff",
            args: {
              target_id: request.actorId === 4 ? 1 : request.actorId === 5 ? 2 : null,
              abstain: request.actorId !== 4 && request.actorId !== 5,
            },
          };
        if (stage === "sheriff_pk_vote")
          return { name: "vote_for_sheriff", args: { target_id: 1, abstain: false } };
        if (request.allowedTools.includes("choose_direction"))
          return { name: "choose_direction", args: { direction: "clockwise" } };
        if (request.allowedTools.includes("guard"))
          return {
            name: "guard",
            args: { target_id: request.context.day === 1 ? 4 : 5, abstain: false },
          };
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: null, abstain: true } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 4 } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("vote")) {
          if (request.context.day > 1 || stage === "exile_pk_vote")
            return { name: "vote", args: { target_id: null, abstain: true } };
          return {
            name: "vote",
            args: { target_id: [2, 1, 1, 1, 2, 2][request.actorId - 1]!, abstain: false },
          };
        }
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
    const record = await readReproduction(path.join(root, "pk-branch/reproduction.json"));
    expect(record.metadata.normalizedBoard.sheriff).toEqual(config.sheriff);
    expect(record.metadata.normalizedBoard.voting).toEqual(config.voting);
    expect(record.events.filter((event) => event.type === "sheriff_pk_started")).toHaveLength(
      pk ? 1 : 0,
    );
    expect(record.events.filter((event) => event.type === "exile_pk_started")).toHaveLength(
      pk ? 1 : 0,
    );
    expect(
      record.decisions.filter((decision) => decision.request.context.stage === "exile_pk_vote"),
    ).toHaveLength(pk ? 4 : 0);
    const before = JSON.stringify(record);
    const replayed = await replayReproduction(record, output);
    expect(replayed.snapshot).toEqual(game.phaseManager.getSnapshot());
    expect(replayed.eventCount).toBe(record.events.length);
    expect(replayed.decisionCount).toBe(record.decisions.length);
    expect(JSON.stringify(record)).toBe(before);
  });
