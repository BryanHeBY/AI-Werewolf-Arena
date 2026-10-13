/**
 * 测试 driver：负责原雾鸦受控执行与录制。输入为原角色、动作计划及局部 store；输出保留原请求和录制前缀，独立预期由外部测试提供，不调用模型。
 */
import type { ReproductionRecord } from "../../../../../src/recording/reproduction";
import type { ActionRequest } from "../../../../../src/core";
import type { MistRecordVariant } from "../builders/board";
import { mistBoard } from "../builders/board";
import { MIST_ROLES } from "../builders/board";
import { mistAction } from "./actions";
import { readFile } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { copyFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../../src/core";
import { createRandom } from "../../../../../src/core";
import type { BadgeComponent } from "../../../../../src/core";
import { SessionRecordManager } from "../../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../../src/recording/recording_context";
import { parseReproductionRecord } from "../../../../../src/recording/reproduction";
import type { RecordedCheckpoint } from "../../../../../src/recording/reproduction";
import { beginGameReproduction } from "../../../../../src/runtime/simulation/reproduction_context";
import { captureCheckpoint } from "../../../../../src/runtime/simulation/reproduction_context";
import { currentEngineVersion } from "../../../../../src/runtime/simulation/reproduction_context";
import { replayReproduction } from "../../../../../src/runtime/simulation/replay_reproduction";
import { GameEventRecorder } from "../../../../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../../../drivers/temp-directories";

const cache = new Map<string, Promise<ReproductionRecord>>();

export interface MistRequestObservation {
  day: number;
  stage: ActionRequest["context"]["stage"];
  actorId: number;
  aliveIds: number[];
  sheriffIds: number[];
  gameOver: boolean;
  publishedTypes: string[];
}

export function mistRecording(
  variant: MistRecordVariant = "linked",
  locale: "en" | "zh-CN" = "en",
  seed = "mist-raven-real-runtime",
  observe?: (observation: MistRequestObservation) => void,
  artifactDirectory?: string,
): Promise<ReproductionRecord> {
  const key = variant + locale + seed;
  if (!observe && !artifactDirectory && cache.has(key)) return cache.get(key)!;
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
      const requestCounts = new Map<string, number>();
      await runWithSessionRecorder(manager, async () => {
        const trace = beginGameReproduction(manager, game, {
          engine: await currentEngineVersion(),
          boardId: board.definition.id,
          ...(void config, {}),
          locale,
          maxDays: 8,
        });
        for (let cycle = 1; cycle <= 8 && !game.phaseManager.getSnapshot().gameOver; cycle++) {
          let cycleFailure: unknown;
          try {
            await game.phaseManager.runSingleCycle(
              {
                getAction: (q) =>
                  trace.decide(q, {
                    async getAction(request) {
                      if (observe)
                        observe({
                          day: request.context.day,
                          stage: request.context.stage,
                          actorId: request.actorId,
                          aliveIds: game.world.getAliveEntityIds(),
                          sheriffIds: game.world
                            .getAliveEntityIds()
                            .filter(
                              (id) =>
                                game.world.getComponent(id, COMPONENT.Badge)
                                  ?.isSheriff,
                            ),
                          gameOver: game.phaseManager.getSnapshot().gameOver,
                          publishedTypes: game.phaseManager.getEvents().map((e) => e.type),
                        });
                      const key = `${request.actorId}/${request.context.day}/${request.context.stage}`;
                      const round = (requestCounts.get(key) ?? 0) + 1;
                      requestCounts.set(key, round);
                      return mistAction(request, variant, round);
                    },
                  }),
              },
              8,
            );
          } catch (error) {
            if (
              variant !== "last-god-illegal-self" ||
              cycle !== 3 ||
              !(error instanceof Error) ||
              error.message !== "snake_action_invalid"
            )
              throw error;
            cycleFailure = error;
            trace.noteFailure("cycle", error);
          }
          last = captureCheckpoint(
            game.world,
            game.phaseManager.getSnapshot(),
            cycle,
            cycleFailure === undefined,
            game.phaseManager.getEvents().length,
            cycleFailure,
          );
          trace.checkpoint(last, game.phaseManager.getEvents());
          events.flush(game.phaseManager.getEvents());
          if (cycleFailure) break;
        }
        const snapshot = game.phaseManager.getSnapshot();
        const failed = variant === "last-god-illegal-self";
        if (failed && (last?.complete || snapshot.gameOver))
          throw new Error("mist_fixture_failed_to_fail");
        if (!failed && (!snapshot.gameOver || snapshot.result?.reason === "max_days_reached"))
          throw new Error("mist_fixture_failed_to_end_naturally");
        await manager.finalize({
          endedAtIso: new Date().toISOString(),
          winner: snapshot.result?.winner ?? null,
          finishReason: failed ? "runtime_error" : snapshot.result!.reason,
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
        JSON.parse(await readFile(manager.sessionDir + "/reproduction.json", "utf8")),
      );
      const replay = await replayReproduction(record, root);
      if (JSON.stringify(replay.snapshot) !== JSON.stringify(record.checkpoints.at(-1)!.snapshot))
        throw new Error("mist_fixture_replay_changed_snapshot");
      if (artifactDirectory) {
        const name = `mist-manual-${variant}-${locale}`;
        await mkdir(path.join(artifactDirectory, "player-views"), { recursive: true });
        await copyFile(
          path.join(manager.sessionDir, "replay.json"),
          path.join(artifactDirectory, name + ".replay.json"),
        );
        await writeFile(
          path.join(artifactDirectory, name + ".checkpoint.txt"),
          JSON.stringify(record.checkpoints.at(-1), null, 2) + "\n",
        );
        for (const [label, actor] of [
          ["alchemist", 1],
          ["raven", 9],
          ["pack", 10],
          ["villager", 5],
        ] as const)
          await copyFile(
            path.join(manager.sessionDir, `players/player_${actor}.json`),
            path.join(artifactDirectory, "player-views", `${name}-${label}.player.json`),
          );
      }
      return record;
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  })();
  if (!observe && !artifactDirectory) cache.set(key, run);
  return run;
}
