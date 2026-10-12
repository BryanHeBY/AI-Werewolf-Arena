/**
 * Complete policy Tape scenarios verify configured inspection and death-action rules execute through real chains.
 * Input: Public policy boards, explicit actions, original native sources and scoped recordings.
 * Output and independent oracle: Literal eligible requests/death sequence and exact strict Tape for both locales.
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
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { COMPONENT, type RoleComponent } from "../../../../src/core";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import { roleInspectionTargets } from "../../../../src/game/mechanisms/roles/role_inspection/rules";
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

for (const inspectionPolicy of [
  "awa_unique_required_v1",
  "awa_repeat_optional_v1",
  "awa_unique_optional_v1",
] as const)
  for (const deathActionPolicy of ["awa_qualified_sources_v1", "awa_knife_or_exile_v1"] as const)
    for (const locale of ["zh-CN", "en"] as const)
      test(`${inspectionPolicy}/${deathActionPolicy}/${locale}: configured native inspection and death chain reproduce through strict actual Tape`, async () => {
        const root = await createTestTempDirectory("awa-configured-role-record-");
        const output = await createTestTempDirectory("awa-configured-role-replay-");
        const roles = [
          Role.WolfKing,
          Role.Hunter,
          Role.Gargoyle,
          Role.Psychic,
          Role.MirrorGirl,
          Role.Villager,
        ];
        const config = parseBoardDefinition(
          boardDefinitionFromConfig("configured_role", {
            ...sixPlayerMvpConfig,
            roleSetups: roles.map((role) => ({ role, count: 1 })),
            hunter: { deathActionPolicy },
            wolfKing: { deathActionPolicy },
            gargoyle: { inspectionPolicy },
            psychic: { inspectionPolicy },
            mirrorGirl: { inspectionPolicy },
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
          ...(void config, {}),
          locale,
          maxDays: 2,
        });
        const actions: ActionProvider = {
          async getAction(request) {
            if (request.allowedTools.includes("inspect_role")) {
              if (request.context.day === 2 && inspectionPolicy !== "awa_unique_required_v1")
                return null;
              const ability = findNightAbility(
                game.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role),
                "role_check",
                request.context.ability_id,
              )!;
              const targets = roleInspectionTargets(game.world, request.actorId, ability.state);
              return {
                name: "inspect_role",
                args: { target_id: targets.includes(6) ? 6 : targets[0]! },
              };
            }
            if (request.allowedTools.includes("shoot"))
              return { name: "shoot", args: { target_id: request.actorId === 2 ? 1 : 6 } };
            if (request.allowedTools.includes("speak_to_wolves"))
              return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
            if (request.allowedTools.includes("kill_vote"))
              return {
                name: "kill_vote",
                args: {
                  target_id: request.context.day === 1 ? 2 : null,
                  abstain: request.context.day !== 1,
                },
              };
            if (request.allowedTools.includes("speak"))
              return { name: "speak", args: { text: "Raw" } };
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
        expect(record.events.filter((event) => event.type === "wolf_king_shot")).toHaveLength(
          deathActionPolicy === "awa_qualified_sources_v1" ? 1 : 0,
        );
        const inspectionDecisions = record.decisions.filter((decision) =>
          decision.request.allowedTools.includes("inspect_role"),
        );
        expect(inspectionDecisions).toHaveLength(6);
        expect(
          inspectionDecisions.map(
            (decision) => decision.request.context.turn_constraints.min_valid_actions,
          ),
        ).toEqual(Array(6).fill(inspectionPolicy === "awa_unique_required_v1" ? 1 : 0));
        expect(
          record.events.filter((event) => event.type === "role_inspection_skipped"),
        ).toHaveLength(inspectionPolicy === "awa_unique_required_v1" ? 0 : 3);
        expect(record.metadata.normalizedBoard.hunter).toEqual({ deathActionPolicy });
        expect(record.metadata.normalizedBoard.mirrorGirl).toEqual({ inspectionPolicy });
        const before = JSON.stringify(record);
        const replayed = await replayReproduction(record, output);
        expect(replayed.snapshot).toEqual(game.phaseManager.getSnapshot());
        expect(replayed.eventCount).toBe(record.events.length);
        expect(replayed.decisionCount).toBe(record.decisions.length);
        expect(JSON.stringify(record)).toBe(before);
      });
