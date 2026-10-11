import { readFile, rm } from "node:fs/promises";
import { bootstrapGame } from "../../src/app/bootstrap";
import { Role, createRandom, type ActionRequest, type ToolCall } from "../../src/core";
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

export const MIST_ROLES = [
  Role.Alchemist,
  Role.Seer,
  Role.Dreamer,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.RavenClawWolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
] as const;
export type MistRecordVariant = "linked" | "saved-dreamer" | "protected-heal" | "draw";
export async function mistBoard() {
  return parseBoardDefinition(
    JSON.parse(
      await readFile(
        new URL("../../../configs.example/boards/awa_mist_raven_12_v1.json", import.meta.url),
        "utf8",
      ),
    ),
  );
}
/** Literal manual scenarios; this controller is intentionally distinct from an observed player. */
export function mistAction(q: ActionRequest, variant: MistRecordVariant): ToolCall | null {
  const s = q.context.stage,
    d = q.context.day;
  if (s === "alchemist_mist")
    return {
      name: "cast_mist",
      args: { target_ids: d === 1 ? (variant === "draw" ? [10, 11, 12] : [5, 6, 11]) : null },
    };
  if (s === "dreamer")
    return {
      name: "dream",
      args: {
        target_id:
          d === 1
            ? variant === "protected-heal"
              ? 5
              : 8
            : d === 2
              ? variant === "protected-heal"
                ? 8
                : 5
              : variant === "saved-dreamer"
                ? 7
                : 5,
      },
    };
  if (s === "wolf_discussion")
    return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
  if (s === "wolf_vote")
    return {
      name: "kill_vote",
      args: {
        target_id:
          d === 1
            ? variant === "draw"
              ? null
              : variant === "protected-heal"
                ? 5
                : 11
            : d === 2
              ? variant === "protected-heal"
                ? 11
                : 3
              : 6,
        abstain: d === 1 && variant === "draw",
      },
    };
  if (s === "raven_knife")
    return { name: "raven_knife", args: { target_id: variant === "saved-dreamer" ? 5 : 3 } };
  if (s === "seer") return { name: "check_identity", args: { target_id: 9 } };
  if (s === "sheriff_nomination") return { name: "run_for_sheriff", args: { run: false } };
  if (s === "alchemist_snake")
    return {
      name: "use_snake",
      args: { target_id: d === 1 ? (variant === "protected-heal" ? 5 : null) : 3 },
    };
  if (s === "day_speech" || s === "last_words") return { name: "speak", args: { text: "Words" } };
  if (s === "voting") {
    const target =
      d === 1
        ? variant === "protected-heal"
          ? 10
          : 12
        : d === 2
          ? variant === "protected-heal"
            ? 12
            : 10
          : 9;
    return {
      name: "vote",
      args: { target_id: q.actorId === target ? null : target, abstain: q.actorId === target },
    };
  }
  return null;
}
const cache = new Map<string, Promise<ReproductionRecord>>();
export function mistRecording(
  variant: MistRecordVariant = "linked",
  locale: "en" | "zh-CN" = "en",
  seed = "mist-raven-real-runtime",
): Promise<ReproductionRecord> {
  const key = variant + locale + seed;
  if (cache.has(key)) return cache.get(key)!;
  const run = (async () => {
    const board = await mistBoard(),
      config = board.config;
    const game = bootstrapGame(config, {
      locale,
      random: createRandom(seed),
      fixedRoles: MIST_ROLES,
    });
    const root = await createTestTempDirectory("awa-mist-tape-");
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
      const events = new GameEventRecorder(
        { world: game.world, replayManager: manager },
        game.phaseManager.getSnapshot().phase,
      );
      let last: RecordedCheckpoint | undefined;
      await runWithSessionRecorder(manager, async () => {
        const trace = beginGameReproduction(manager, game, {
          engine: await currentEngineVersion(),
          boardId: board.definition.id,
          boardConfig: config,
          locale,
          maxDays: 8,
        });
        for (let cycle = 1; cycle <= 8 && !game.phaseManager.getSnapshot().gameOver; cycle++) {
          await game.phaseManager.runSingleCycle(
            {
              getAction: (q) =>
                trace.decide(q, {
                  async getAction(request) {
                    return mistAction(request, variant);
                  },
                }),
            },
            8,
          );
          last = captureCheckpoint(
            game.world,
            game.phaseManager.getSnapshot(),
            cycle,
            true,
            game.phaseManager.getEvents().length,
          );
          trace.checkpoint(last, game.phaseManager.getEvents());
          events.flush(game.phaseManager.getEvents());
        }
        const snapshot = game.phaseManager.getSnapshot();
        if (!snapshot.gameOver || snapshot.result?.reason === "max_days_reached")
          throw new Error("mist_fixture_failed_to_end_naturally");
        await manager.finalize({
          endedAtIso: new Date().toISOString(),
          winner: snapshot.result?.winner ?? null,
          finishReason: snapshot.result!.reason,
          gameResult: snapshot.result!,
          players: last!.players.map((p) => ({
            player_id: p.id,
            role: p.role,
            camp: p.camp,
            alive: p.alive,
          })),
        });
      });
      const record = parseReproductionRecord(
        JSON.parse(await readFile(manager.sessionDir + "/reproduction.json", "utf8")),
      );
      const replay = await replayReproduction(record, root);
      if (JSON.stringify(replay.snapshot) !== JSON.stringify(record.checkpoints.at(-1)!.snapshot))
        throw new Error("mist_fixture_replay_changed_snapshot");
      return record;
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  })();
  cache.set(key, run);
  return run;
}
