/**
 * Red Moon edge recording/verifier scenarios verify last-side death, delayed expiry and seal edge cases.
 * Input: Fixed native scripts, both last-wolf policies/locales and independently mutated checkpoints.
 * Output and independent oracle: Manual terminal/death/resource prefix and exact replay, with forged causal state rejected.
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
} from "../../../../src/domain";
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
for (const mode of ["poison", "hunt", "normal_exile", "last_blast", "idiot", "badge"] as const)
  for (const policy of ["ends_game", "forbidden"] as const)
    for (const locale of ["zh-CN", "en"] as const)
      test(
        "actual Red Moon edge Tape " + mode + "/" + policy + "/" + locale,
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
            let lastWolfBlastRequests = 0;
            const provider = {
              async getAction(r: ActionRequest): Promise<ToolCall | null> {
                const day = r.context.day;
                if (r.actorId === 4 && day === 2 && r.allowedTools.includes("self_destruct")) {
                  lastWolfBlastRequests++;
                  if (mode === "last_blast")
                    return {
                      name: "self_destruct",
                      args: { reason: "Last wolf blast", confirm: true },
                    };
                }
                if (mode === "badge" && r.allowedTools.includes("run_for_sheriff"))
                  return { name: "run_for_sheriff", args: { run: r.actorId === 4 } };
                if (r.allowedTools.includes("vote_for_sheriff"))
                  return { name: "vote_for_sheriff", args: { target_id: 4, abstain: false } };
                if (r.allowedTools.includes("choose_direction"))
                  return { name: "choose_direction", args: { direction: "clockwise" } };
                if (r.allowedTools.includes("vote"))
                  return {
                    name: "vote",
                    args: {
                      target_id:
                        mode === "idiot"
                          ? day === 1
                            ? 12
                            : day === 2
                              ? 3
                              : 4
                          : mode === "normal_exile"
                            ? day === 1
                              ? 4
                              : 3
                            : day === 1
                              ? 2
                              : 4,
                      abstain: false,
                    },
                  };
                if (r.allowedTools.includes("check_identity"))
                  return { name: "check_identity", args: { target_id: 8 } };
                return demonNightChoice(r, 10, {
                  knife:
                    mode === "poison" && day === 1
                      ? 1
                      : day === 1
                        ? 5
                        : day === 2
                          ? 6
                          : day === 3
                            ? 7
                            : 9,
                  potion:
                    mode === "poison"
                      ? day === 3
                        ? { target: 4, type: PotionType.Poison }
                        : undefined
                      : day === 1
                        ? { target: 1, type: PotionType.Poison }
                        : undefined,
                  hunt:
                    day === 2
                      ? mode === "idiot" || mode === "normal_exile"
                        ? 2
                        : 3
                      : mode === "hunt" && day === 3
                        ? 4
                        : null,
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
            expect(record.checkpoints.at(-1)!.snapshot.result!.winner).toBe(Camp.Good);
            const delayed =
              mode !== "normal_exile" && !(mode === "last_blast" && policy === "ends_game");
            const expired =
              mode === "idiot" ||
              mode === "badge" ||
              (mode === "last_blast" && policy === "forbidden");
            expect(record.events.filter((e) => e.type === "red_moon_exile_delayed")).toHaveLength(
              delayed ? 1 : 0,
            );
            expect(record.events.filter((e) => e.type === "red_moon_delay_expired")).toHaveLength(
              expired ? 1 : 0,
            );
            expect(record.events.filter((e) => e.type === "red_moon_night_sealed")).toHaveLength(0);
            if (mode === "last_blast")
              expect(lastWolfBlastRequests).toBe(policy === "forbidden" ? 0 : 1);
            if (mode === "normal_exile")
              expect(
                record.events.some((e) => e.type === "voted_out" && e.payload.target === 4),
              ).toBe(true);
            if (mode === "badge") {
              expect(
                record.checkpoints.some(
                  (cp) => cp.players.find((p) => p.id === 4)?.badge.isSheriff,
                ),
              ).toBe(true);
              expect(
                record.events.some(
                  (e) =>
                    e.type === "sheriff_badge_transferred" &&
                    e.payload.fromId === 4 &&
                    e.payload.toId === 8,
                ),
              ).toBe(true);
            }
            if (mode === "idiot") {
              expect(record.events.filter((e) => e.type === "idiot_revealed")).toHaveLength(1);
              for (const finalized of [true, false]) {
                const bad = structuredClone(record);
                bad.finalized = finalized;
                if (!finalized) {
                  bad.operations = [];
                  bad.termination = null;
                }
                expect(() => parseReproductionRecord(bad)).not.toThrow();
                bad.checkpoints.at(-1)!.players.find((p) => p.id === 12)!.vote = {
                  canVote: true,
                  weight: 1,
                };
                expect(() => parseReproductionRecord(bad)).toThrow();
              }
            }
            for (const type of ["red_moon_exile_delayed", "red_moon_delay_expired"]) {
              if (!record.events.some((e) => e.type === type)) continue;
              const bad = structuredClone(record);
              bad.events.find((e) => e.type === type)!.payload.actorId = 12;
              expect(() => parseReproductionRecord(bad)).toThrow();
            }
            const replay = await replayReproduction(record, root);
            expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
            expect(() => parseReproductionRecord(JSON.parse(JSON.stringify(record)))).not.toThrow();
          } finally {
            await fs.rm(root, { recursive: true, force: true });
          }
        },
        120000,
      );
