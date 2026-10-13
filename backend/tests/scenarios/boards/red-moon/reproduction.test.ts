/**
 * Red Moon recording/replay scenarios verify expiry, knife and blast policy tapes.
 * Input: Actual fixed-action games, both policies/locales and temporary finalized records.
 * Output and independent oracle: Handwritten state/terminal checkpoints and strict rejection/reproduction of original causal tapes.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  createRandom,
  Camp,
  PotionType,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/core";
import { redMoonTwelveConfig } from "../../../../src/runtime/scenarios/red_moon_twelve";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/runtime/simulation/reproduction_context";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import {
  parseReproductionRecord,
  type RecordedCheckpoint,
} from "../../../../src/recording/reproduction";
import { GameEventRecorder } from "../../../../src/runtime/game_event_recorder";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
let version: ReturnType<typeof currentEngineVersion> | undefined;
for (const mode of ["expire", "knife", "blast"] as const)
  for (const policy of ["ends_game", "forbidden"] as const)
    for (const locale of ["zh-CN", "en"] as const)
      test(
        "actual Red Moon Tape " + mode + "/" + policy + "/" + locale,
        async () => {
          const config = structuredClone(redMoonTwelveConfig);
          config.redMoon!.lastWolfBlastPolicy = policy;
          const context = bootstrapGame(config, {
            fixedRoles: config.roleSetups.flatMap((row) => Array(row.count).fill(row.role)),
            locale,
            random: createRandom("red-tape:" + mode + ":" + policy + ":" + locale),
          });
          const root = await createTestTempDirectory("awa-red-tape-");
          try {
            const manager = await SessionRecordManager.create(
              {
                sessionId: "game",
                board: "red_moon_twelve",
                startedAtIso: new Date().toISOString(),
                locale,
                random: context.random.metadata,
              },
              root,
            );
            const recorder = new GameEventRecorder(
              { world: context.world, replayManager: manager },
              context.phaseManager.getSnapshot().phase,
            );
            let last: RecordedCheckpoint | undefined;
            const provider = {
              async getAction(r: ActionRequest): Promise<ToolCall | null> {
                const day = r.context.day;
                if (
                  mode === "blast" &&
                  r.actorId === 4 &&
                  day === 1 &&
                  r.allowedTools.includes("self_destruct")
                )
                  return { name: "self_destruct", args: { reason: "Golden blast", confirm: true } };
                if (r.allowedTools.includes("vote"))
                  return {
                    name: "vote",
                    args: {
                      target_id:
                        mode === "blast"
                          ? day === 2
                            ? 1
                            : 2
                          : day === 1
                            ? 2
                            : day === 2
                              ? mode === "knife"
                                ? 7
                                : 4
                              : 4,
                      abstain: false,
                    },
                  };
                if (r.allowedTools.includes("check_identity"))
                  return { name: "check_identity", args: { target_id: 8 } };
                return demonNightChoice(r, 10, {
                  knife: day === 1 ? 5 : day === 2 ? 6 : mode === "knife" ? (day === 3 ? 9 : 8) : 7,
                  potion:
                    mode !== "blast" && day === 1
                      ? { target: 1, type: PotionType.Poison }
                      : undefined,
                  hunt: mode === "blast" ? (day === 3 ? 3 : null) : day === 2 ? 3 : null,
                });
              },
            };
            await runWithSessionRecorder(manager, async () => {
              const trace = beginGameReproduction(manager, context, {
                engine: await (version ??= currentEngineVersion()),
                boardId: "red_moon_twelve",
                ...(void config, {}),
                locale,
                maxDays: 8,
              });
              for (
                let cycle = 1;
                cycle <= 8 && !context.phaseManager.getSnapshot().gameOver;
                cycle++
              ) {
                await context.phaseManager.runSingleCycle(
                  { getAction: (r) => trace.decide(r, provider) },
                  8,
                );
                last = captureCheckpoint(
                  context.world,
                  context.phaseManager.getSnapshot(),
                  cycle,
                  true,
                  context.phaseManager.getEvents().length,
                );
                trace.checkpoint(last, context.phaseManager.getEvents());
                recorder.flush(context.phaseManager.getEvents());
              }
              const snapshot = context.phaseManager.getSnapshot();
              expect(snapshot.gameOver).toBe(true);
              expect(snapshot.result!.reason).not.toBe("max_days_reached");
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
            const record = await readReproduction(manager.sessionDir + "/reproduction.json");
            expect(record.checkpoints.at(-1)!.snapshot.result!.winner).toBe(
              mode === "knife" ? Camp.Wolf : Camp.Good,
            );
            const replay = await replayReproduction(record, root);
            expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
            expect(() => parseReproductionRecord(JSON.parse(JSON.stringify(record)))).not.toThrow();
          } finally {
            await fs.rm(root, { recursive: true, force: true });
          }
        },
        120000,
      );
