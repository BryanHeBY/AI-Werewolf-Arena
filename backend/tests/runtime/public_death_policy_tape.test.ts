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
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
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
import { createTestTempDirectory } from "../support/temp_directory";

for (const policy of ["awa_initial_wave_v1", "netease_2017_day_and_first_night_v1"] as const)
  for (const deathRevealPolicy of ["awa_hidden_v1", "netease_2017_open_v1"] as const)
    for (const locale of ["zh-CN", "en"] as const)
      test(`${policy}/${deathRevealPolicy}/${locale}: actual full public death policy game and strict Tape`, async () => {
        const root = await createTestTempDirectory("awa-configured-role-record-");
        const output = await createTestTempDirectory("awa-configured-role-replay-");
        const roles = [
          Role.Wolf,
          Role.Hunter,
          Role.WolfKing,
          Role.Villager,
          Role.Villager,
          Role.Villager,
        ];
        const config = parseBoardDefinition(
          boardDefinitionFromConfig("public_death", {
            ...sixPlayerMvpConfig,
            roleSetups: [
              { role: Role.Wolf, count: 1 },
              { role: Role.Hunter, count: 1 },
              { role: Role.WolfKing, count: 1 },
              { role: Role.Villager, count: 3 },
            ],
            lastWords: { policy },
            disclosure: { deathRevealPolicy },
            winConditions: [WinCondition.SlaughterCity],
            selfDestruct: { enabledWindows: [] },
          }),
        ).config;
        const game = bootstrapGame(config, {
          random: createRandom("configured-role"),
          fixedRoles: roles,
          locale,
        });
        const manager = await SessionRecordManager.create(
          {
            sessionId: "configured-role",
            board: "configured_role",
            startedAtIso: "2026-10-09T00:00:00.000Z",
          },
          root,
        );
        const trace = beginGameReproduction(manager, game, {
          engine: await currentEngineVersion(),
          boardId: "configured_role",
          boardConfig: config,
          locale,
          maxDays: 2,
        });
        const actions: ActionProvider = {
          async getAction(request) {
            if (request.allowedTools.includes("shoot"))
              return { name: "shoot", args: { target_id: request.actorId === 2 ? 3 : 4 } };
            if (request.allowedTools.includes("speak_to_wolves"))
              return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
            if (request.allowedTools.includes("kill_vote"))
              return {
                name: "kill_vote",
                args: {
                  target_id: request.context.day === 1 ? 2 : 5,
                  abstain: false,
                },
              };
            if (request.allowedTools.includes("speak"))
              return { name: "speak", args: { text: "Raw" } };
            if (request.allowedTools.includes("vote"))
              return {
                name: "vote",
                args: {
                  target_id: request.context.day === 1 ? null : 1,
                  abstain: request.context.day === 1,
                },
              };
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
            players: captureCheckpoint(game.world, snapshot, cycle, true, 0).players.map(
              (player) => ({
                player_id: player.id,
                role: player.role,
                camp: player.camp,
                alive: player.alive,
              }),
            ),
          });
        });
        const record = await readReproduction(path.join(root, "configured-role/reproduction.json"));
        expect(record.metadata.normalizedBoard).toEqual(config);
        expect(record.events.filter((event) => event.type === "hunter_shot")).toHaveLength(1);
        expect(record.events.filter((event) => event.type === "wolf_king_shot")).toHaveLength(1);
        const granted = record.events
          .filter((event) => event.type === "last_words_granted")
          .map((event) => event.payload.playerId);
        expect(granted).toEqual(policy === "awa_initial_wave_v1" ? [2, 1] : [2, 3, 4, 1]);
        expect(
          record.events
            .filter((event) => event.type === "last_words_spoken")
            .map((event) => event.payload.playerId),
        ).toEqual(granted);
        expect(
          record.events
            .filter((event) => event.type === "player_role_revealed")
            .map((event) => event.payload.playerId),
        ).toEqual(deathRevealPolicy === "awa_hidden_v1" ? [] : [2, 3, 4, 5, 1]);
        for (const decision of record.decisions) {
          const facts =
            decision.request.context.visible_events?.filter(
              (event) => event.type === "player_role_revealed",
            ) ?? [];
          if (deathRevealPolicy === "awa_hidden_v1") expect(facts).toEqual([]);
          for (const fact of facts)
            expect(Object.keys(fact.payload).sort()).toEqual(["playerId", "role"]);
        }
        expect(record.metadata.normalizedBoard.lastWords).toEqual({ policy });
        expect(record.metadata.normalizedBoard.disclosure).toEqual({ deathRevealPolicy });
        const before = JSON.stringify(record);
        const replayed = await replayReproduction(record, output);
        expect(replayed.snapshot).toEqual(game.phaseManager.getSnapshot());
        expect(replayed.eventCount).toBe(record.events.length);
        expect(replayed.decisionCount).toBe(record.decisions.length);
        expect(JSON.stringify(record)).toBe(before);
      });
