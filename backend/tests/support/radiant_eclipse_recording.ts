import { radiantFullPlans, type RadiantFullPlanName } from "./radiant_eclipse_full_plans";
import { readFile, rm, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapGame, type BootstrapResult } from "../../src/app/bootstrap";
import {
  createRandom,
  PotionType,
  type ActionProvider,
  type ActionRequest,
  type ToolCall,
} from "../../src/core";
import { radiantRoles, radiantProvider } from "./radiant_eclipse";
import { parseBoardDefinition } from "../../src/runtime/config/board_definition";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import {
  parseReproductionRecord,
  type RecordedCheckpoint,
  type ReproductionRecord,
} from "../../src/recording/reproduction";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../src/runtime/simulation/reproduction_context";
import { replayReproduction } from "../../src/runtime/simulation/replay_reproduction";
import { GameEventRecorder } from "../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "./temp_directory";

/** Literal four-night plan: every wolf is exiled through real ballots. No state injection. */
export function radiantManualAction(
  q: ActionRequest,
  planName?: RadiantFullPlanName,
): ToolCall | undefined {
  if (planName) {
    const plan = radiantFullPlans.find((p) => p.name === planName)!,
      night = plan.nights[q.context.day - 1];
    if (!night) throw Error("radiant_full_plan_exhausted");
    switch (q.context.stage) {
      case "eclipse_swallow":
        return { name: "swallow_skill", args: { target_id: night.swallow } };
      case "radiant_shelter":
        return { name: "cast_shelter", args: { target_id: night.shelter } };
      case "dreamer":
        return { name: "dream", args: { target_id: night.dream } };
      case "wolf_vote":
        return { name: "kill_vote", args: { target_id: night.knife, abstain: false } };
      case "witch": {
        const bottle = "potion" in night ? night.potion : undefined;
        return {
          name: "use_potion",
          args: {
            target_id: bottle?.[1] ?? q.actorId,
            potion_type:
              bottle?.[0] === "heal"
                ? PotionType.Heal
                : bottle?.[0] === "poison"
                  ? PotionType.Poison
                  : PotionType.None,
          },
        };
      }
      case "seer":
        return { name: "check_identity", args: { target_id: "seer" in night ? night.seer : 1 } };
      case "sheriff_nomination":
      case "sheriff_withdraw":
        return { name: "run_for_sheriff", args: { run: q.actorId === plan.sheriff } };
      case "sheriff_vote":
      case "sheriff_pk_vote":
        return {
          name: "vote_for_sheriff",
          args: { target_id: plan.sheriff, abstain: plan.sheriff === null },
        };
      case "sheriff_choose_direction":
        return { name: "choose_direction", args: { direction: "clockwise" } };
      case "sheriff_badge_choice":
        return { name: "choose_badge_successor", args: { target_id: 2 } };
      case "voting":
        return {
          name: "vote",
          args: {
            target_id: q.actorId === night.exile ? null : night.exile,
            abstain: night.exile === null || q.actorId === night.exile,
          },
        };
    }
    return undefined;
  }
  const day = q.context.day;
  switch (q.context.stage) {
    case "eclipse_swallow":
      return { name: "swallow_skill", args: { target_id: day === 2 ? 4 : day === 3 ? 2 : 5 } };
    case "radiant_shelter":
      return { name: "cast_shelter", args: { target_id: day === 2 ? 6 : day === 3 ? 5 : 7 } };
    case "dreamer":
      return {
        name: "dream",
        args: { target_id: day === 1 ? 6 : day === 2 ? 8 : day === 3 ? 1 : 7 },
      };
    case "wolf_vote":
      return {
        name: "kill_vote",
        args: { target_id: day === 1 ? 10 : day === 2 ? 8 : day === 3 ? 5 : 7, abstain: false },
      };
    case "witch":
      return {
        name: "use_potion",
        args:
          day === 1
            ? { target_id: 10, potion_type: PotionType.Heal }
            : day === 2
              ? { target_id: 6, potion_type: PotionType.Poison }
              : day === 3
                ? { target_id: 1, potion_type: PotionType.Poison }
                : { target_id: q.actorId, potion_type: PotionType.None },
      };
    case "seer":
      return { name: "check_identity", args: { target_id: 1 } };
    case "voting": {
      const target = day === 1 ? 10 : day === 2 ? 11 : day === 3 ? 12 : 1;
      return {
        name: "vote",
        args: { target_id: q.actorId === target ? null : target, abstain: q.actorId === target },
      };
    }
  }
  return undefined;
}
export interface RadiantRecordingOptions {
  locale?: "zh-CN" | "en";
  planName?: RadiantFullPlanName;
  seed?: string;
  failureStage?: ActionRequest["context"]["stage"];
  failureMode?: "missing" | "error";
  artifactDirectory?: string;
  provider?: (
    game: BootstrapResult,
    manual: ActionProvider,
  ) => Promise<ActionProvider> | ActionProvider;
}
export async function radiantRecording(
  options: RadiantRecordingOptions = {},
): Promise<ReproductionRecord> {
  const locale = options.locale ?? "en",
    seed = options.seed ?? "radiant-eclipse-real-recording";
  const board = parseBoardDefinition(
    JSON.parse(
      await readFile(
        new URL("../../../configs.example/boards/awa_radiant_eclipse_12_v1.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const game = bootstrapGame(board.config, {
    locale,
    fixedRoles: radiantRoles,
    random: createRandom(seed),
  });
  const root = await createTestTempDirectory("awa-radiant-tape-");
  try {
    const manager = await SessionRecordManager.create(
      {
        sessionId: "game",
        board: board.definition.id,
        startedAtIso: new Date().toISOString(),
        locale,
        random: game.random.metadata,
      },
      root,
    );
    const recorder = new GameEventRecorder(
      { world: game.world, replayManager: manager },
      game.phaseManager.getSnapshot().phase,
    );
    const manual = radiantProvider([], {}, (q) => {
      if (q.context.day === 2 && q.context.stage === options.failureStage) {
        if (options.failureMode === "error") throw new Error("synthetic_radiant_provider_failure");
        return null;
      }
      return radiantManualAction(q, options.planName);
    });
    const provider = options.provider ? await options.provider(game, manual) : manual;
    let last: RecordedCheckpoint | undefined;
    await runWithSessionRecorder(manager, async () => {
      const trace = beginGameReproduction(manager, game, {
        engine: await currentEngineVersion(),
        boardId: board.definition.id,
        boardConfig: board.config,
        locale,
        maxDays: 6,
      });
      for (let cycle = 1; cycle <= 6 && !game.phaseManager.getSnapshot().gameOver; cycle++) {
        let failure: unknown;
        try {
          await game.phaseManager.runSingleCycle(
            { getAction: (q) => trace.decide(q, provider) },
            6,
          );
        } catch (error) {
          if (!options.failureStage) throw error;
          failure = error;
          trace.noteFailure("cycle", error);
        }
        last = captureCheckpoint(
          game.world,
          game.phaseManager.getSnapshot(),
          cycle,
          failure === undefined,
          game.phaseManager.getEvents().length,
          failure,
        );
        trace.checkpoint(last, game.phaseManager.getEvents());
        recorder.flush(game.phaseManager.getEvents());
        if (failure) break;
      }
      const snapshot = game.phaseManager.getSnapshot();
      if (options.failureStage) {
        if (last?.complete || snapshot.gameOver) throw Error("radiant_fixture_failed_to_fail");
      } else if (!snapshot.gameOver || snapshot.result?.reason === "max_days_reached")
        throw Error("radiant_fixture_failed_to_end_naturally");
      await manager.finalize({
        endedAtIso: new Date().toISOString(),
        winner: snapshot.result?.winner ?? null,
        finishReason: options.failureStage ? "runtime_error" : snapshot.result!.reason,
        ...(snapshot.result ? { gameResult: snapshot.result } : {}),
        players: last!.players.map((p) => ({
          player_id: p.id,
          role: p.role,
          camp: p.camp,
          alive: p.alive,
        })),
      });
    });
    const record = parseReproductionRecord(
      JSON.parse(await readFile(path.join(manager.sessionDir, "reproduction.json"), "utf8")),
    );
    const replay = await replayReproduction(record, root);
    if (JSON.stringify(replay.snapshot) !== JSON.stringify(record.checkpoints.at(-1)!.snapshot))
      throw Error("radiant_fixture_replay_changed_snapshot");
    if (options.artifactDirectory) {
      await mkdir(options.artifactDirectory, { recursive: true });
      for (const name of [
        "reproduction.json",
        "replay.json",
        "manifest.json",
        "phase_windows.json",
        "timeline_index.json",
      ])
        await copyFile(
          path.join(manager.sessionDir, name),
          path.join(options.artifactDirectory, name),
        );
      await mkdir(path.join(options.artifactDirectory, "players"), { recursive: true });
      for (let actor = 1; actor <= 12; actor++)
        await copyFile(
          path.join(manager.sessionDir, `players/player_${actor}.json`),
          path.join(options.artifactDirectory, `players/player_${actor}.json`),
        );
    }
    return record;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
