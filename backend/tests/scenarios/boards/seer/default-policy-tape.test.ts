/**
 * 完整预言家 Tape 场景验证原生默认目标／必选政策与实际请求一致。输入为公开默认／覆盖板子、字面行动、固定 RNG 和真实记录；独立目标／请求序列及严格 JSON Tape 复现是预期，不调用计费模型或改写 Tape 样本。
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
import { SEER_ROLE_PROFILE } from "../../../../src/game/mechanisms/roles/seer/profile";
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

import baselineRequest from "../../../support/seer_baseline_request.json";

const cases = [
  ["omitted", undefined],
  ["empty", {}],
  [
    "explicit-default",
    { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
  ],
  ["target-only", { targetPolicy: "awa_fresh_others_v1" }],
  ["optional", { actionPolicy: "awa_optional_v1" }],
  ["reverse-old-config", undefined],
] as const;
for (const [name, parameters] of cases)
  test(`${name}: Seer defaults, actual requests and strict JSON Tape agree`, async () => {
    const root = await createTestTempDirectory("awa-seer-default-record-");
    const output = await createTestTempDirectory("awa-seer-default-replay-");
    const oldConfig = { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] };
    const raw = boardDefinitionFromConfig("seer_default", oldConfig);
    if (name !== "reverse-old-config") {
      delete raw.roles.seer;
      if (parameters !== undefined) raw.roles.seer = parameters;
    }
    const config = parseBoardDefinition(raw).config;
    const actionPolicy = name === "optional" ? "awa_optional_v1" : "awa_required_when_legal_v1";
    const targetPolicy = name === "target-only" ? "awa_fresh_others_v1" : "awa_alive_v1";
    expect(config.seer).toEqual({ actionPolicy, targetPolicy });
    expect(SEER_ROLE_PROFILE.runtime.configuration!.schema.parse({})).toEqual(
      SEER_ROLE_PROFILE.runtime.configuration!.defaults,
    );
    expect(parseBoardDefinition(boardDefinitionFromConfig("seer_default", config)).config).toEqual(
      config,
    );
    const game = bootstrapGame(config, {
      random: createRandom("seer-default"),
      fixedRoles: [Role.Guard, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer],
    });
    const manager = await SessionRecordManager.create(
      {
        sessionId: "seer-default",
        board: "seer_default",
        startedAtIso: "2026-10-09T00:00:00.000Z",
      },
      root,
    );
    const trace = beginGameReproduction(manager, game, {
      engine: await currentEngineVersion(),
      boardId: "seer_default",
      ...(void config, {}),
      locale: "zh-CN",
      maxDays: 3,
    });
    const actions: ActionProvider = {
      async getAction(request) {
        if (request.allowedTools.includes("guard"))
          return {
            name: "guard",
            args: { target_id: request.context.day === 2 ? 5 : 4, abstain: false },
          };
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: null, abstain: true } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: request.context.day + 2 } };
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
    const record = await readReproduction(path.join(root, "seer-default/reproduction.json"));
    expect(record.metadata.normalizedBoard.seer).toEqual({ targetPolicy, actionPolicy });
    const decisions = record.decisions.filter((decision) =>
      decision.request.allowedTools.includes("check_identity"),
    );
    expect(decisions).toHaveLength(3);
    if (name !== "optional")
      for (const decision of decisions) {
        expect(JSON.stringify(decision.request.allowedTools)).toBe(
          JSON.stringify(baselineRequest.request.allowedTools),
        );
        expect(JSON.stringify(decision.request.context.turn_constraints)).toBe(
          JSON.stringify(baselineRequest.request.turn_constraints),
        );
      }
    expect(
      decisions.map((decision) => decision.request.context.turn_constraints.min_valid_actions),
    ).toEqual(Array(3).fill(actionPolicy === "awa_optional_v1" ? 0 : 1));
    expect(record.events.filter((event) => event.type === "seer_checked")).toHaveLength(3);
    const before = JSON.stringify(record);
    const replayed = await replayReproduction(record, output);
    expect(replayed.snapshot).toEqual(game.phaseManager.getSnapshot());
    expect(replayed.eventCount).toBe(record.events.length);
    expect(replayed.decisionCount).toBe(record.decisions.length);
    expect(JSON.stringify(record)).toBe(before);
  });
