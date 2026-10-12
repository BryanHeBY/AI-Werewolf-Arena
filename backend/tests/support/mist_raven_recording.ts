import { readFile, rm, mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapGame } from "../../src/app/bootstrap";
import {
  ActionWindow,
  COMPONENT,
  Role,
  createRandom,
  type ActionRequest,
  type ToolCall,
  type BadgeComponent,
} from "../../src/core";
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
import { createTestTempDirectory } from "./drivers/temp-directories";

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
export type MistRecordVariant =
  | "linked"
  | "saved-dreamer"
  | "protected-heal"
  | "draw"
  | "pure-saved-dreamer"
  | "consecutive-heal"
  | "ordinary-double"
  | "mixed-order"
  | "self-heal"
  | "blast-pre-election"
  | "blast-daybreak"
  | "blast-speech-gap"
  | "blast-pre-vote"
  | "blast-raw-target"
  | "blast-badge-chain"
  | "blast-last-wolf"
  | "blast-parallel"
  | "blast-parallel-raw-loser"
  | "blast-parallel-second-gap"
  | "last-villager-pass"
  | "last-villager-heal"
  | "last-god"
  | "last-god-illegal-self";
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
type NightPlan = {
  dream: number[];
  knife: Array<number | null>;
  snake: Array<number | null>;
  extra: Array<number | null>;
  exile: number[];
  circle: number[] | null;
  blast?: { day: number; window: ActionWindow };
  doubleBadge?: boolean;
  parallelBlast?: boolean;
  blastRound?: number;
};
const blastPlan = (window: ActionWindow): NightPlan => ({
  dream: [8, 6, 7],
  knife: [5, 11, 6],
  snake: [null, null, 6],
  extra: [null, null, 3],
  exile: [12, 12, 9],
  circle: [5, 6, 11],
  blast: { day: 1, window },
});
/** Handwritten choices for original seats; expected outcomes live separately in the tests. */
const manualPlans: Record<MistRecordVariant, NightPlan> = {
  linked: {
    dream: [8, 5, 5],
    knife: [11, 3, 6],
    snake: [null, 3, null],
    extra: [null, 3, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "saved-dreamer": {
    dream: [8, 5, 7],
    knife: [11, 3, 6],
    snake: [null, 3, null],
    extra: [null, 5, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "protected-heal": {
    dream: [5, 8, 5],
    knife: [5, 11, 6],
    snake: [5, null, null],
    extra: [null, null, 3],
    exile: [10, 12, 9],
    circle: [5, 6, 11],
  },
  draw: {
    dream: [8, 5, 5],
    knife: [null, 3, 6],
    snake: [null, 3, null],
    extra: [null, 3, null],
    exile: [12, 10, 9],
    circle: [10, 11, 12],
  },
  "pure-saved-dreamer": {
    dream: [8, 5, 7],
    knife: [11, 3, 6],
    snake: [null, 3, null],
    extra: [null, null, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "consecutive-heal": {
    dream: [5, 5, 7],
    knife: [11, 5, 6],
    snake: [null, 5, null],
    extra: [null, null, 3],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "ordinary-double": {
    dream: [8, 5, 7],
    knife: [11, 6, 8],
    snake: [null, 6, null],
    extra: [null, 6, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "mixed-order": {
    dream: [5, 5, 5],
    knife: [11, 3, 6],
    snake: [null, 3, null],
    extra: [null, 3, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "self-heal": {
    dream: [8, 5, 7],
    knife: [1, 11, 6],
    snake: [1, null, null],
    extra: [null, null, 3],
    exile: [12, 10, 9],
    circle: [1, 6, 11],
  },
  "blast-pre-election": blastPlan(ActionWindow.OnPreElection),
  "blast-daybreak": blastPlan(ActionWindow.OnDaybreak),
  "blast-speech-gap": blastPlan(ActionWindow.OnPerSpeechGap),
  "blast-pre-vote": blastPlan(ActionWindow.OnPreVote),
  "blast-raw-target": {
    ...blastPlan(ActionWindow.OnPerSpeechGap),
    circle: [10, 6, 11],
    knife: [10, 11, 6],
  },
  "blast-badge-chain": { ...blastPlan(ActionWindow.OnPerSpeechGap), doubleBadge: true },
  "blast-parallel": { ...blastPlan(ActionWindow.OnPerSpeechGap), parallelBlast: true },
  "blast-parallel-raw-loser": {
    ...blastPlan(ActionWindow.OnPerSpeechGap),
    parallelBlast: true,
    knife: [11, 12, 6],
    exile: [12, 8, 9],
  },
  "blast-parallel-second-gap": {
    ...blastPlan(ActionWindow.OnPerSpeechGap),
    parallelBlast: true,
    blastRound: 2,
    knife: [11, 12, 6],
    exile: [12, 8, 9],
  },
  "blast-last-wolf": {
    dream: [8, 7, 6],
    knife: [11, 9, 2],
    snake: [null, null, 2],
    extra: [null, null, null],
    exile: [12, 12, 9],
    circle: null,
    blast: { day: 3, window: ActionWindow.OnDaybreak },
  },
  "last-villager-pass": {
    dream: [1, 2, 1],
    knife: [5, 7, 8],
    snake: [null, null, null],
    extra: [null, null, null],
    exile: [6, 4, 12],
    circle: [5, 6, 7],
  },
  "last-villager-heal": {
    dream: [1, 2, 1, 2],
    knife: [5, 7, 8, 8],
    snake: [null, null, 8, null],
    extra: [null, null, null, null],
    exile: [6, 4, 12, 12],
    circle: [5, 6, 7],
  },
  "last-god": {
    dream: [5, 5, 5],
    knife: [2, 4, 1],
    snake: [null, null, null],
    extra: [null, null, null],
    exile: [3, 6, 12],
    circle: [2, 4, 1],
  },
  "last-god-illegal-self": {
    dream: [5, 5, 5],
    knife: [2, 4, 1],
    snake: [null, null, 1],
    extra: [null, null, null],
    exile: [3, 6, 12],
    circle: [2, 4, 1],
  },
};
/** Literal manual scenarios; this controller is intentionally distinct from an observed player. */
export function mistAction(
  q: ActionRequest,
  variant: MistRecordVariant,
  windowRound = 1,
): ToolCall | null {
  const s = q.context.stage,
    d = q.context.day,
    index = d - 1,
    plan = manualPlans[variant];
  if (d > plan.knife.length) throw new Error("mist_fixture_unexpected_day");
  if (
    plan.blast &&
    d === plan.blast.day &&
    s === plan.blast.window &&
    windowRound === (plan.blastRound ?? 1) &&
    (q.actorId === 10 || (plan.parallelBlast && q.actorId === 11))
  )
    return { name: "self_destruct", args: { confirm: true, reason: "Manual blast" } };
  if (s === "alchemist_mist")
    return {
      name: "cast_mist",
      args: { target_ids: d === 1 && plan.circle ? [...plan.circle] : null },
    };
  if (s === "dreamer") return { name: "dream", args: { target_id: plan.dream[index]! } };
  if (s === "wolf_discussion")
    return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
  if (s === "wolf_vote")
    return {
      name: "kill_vote",
      args: { target_id: plan.knife[index]!, abstain: plan.knife[index] === null },
    };
  if (s === "raven_knife") return { name: "raven_knife", args: { target_id: plan.extra[index]! } };
  if (s === "seer")
    return { name: "check_identity", args: { target_id: variant === "blast-last-wolf" ? 10 : 9 } };
  if (s === "sheriff_nomination")
    return { name: "run_for_sheriff", args: { run: !!plan.blast && q.actorId === 10 } };
  if (plan.blast && s === "sheriff_withdraw")
    return { name: "run_for_sheriff", args: { run: true } };
  if (plan.blast && s === "sheriff_choose_direction")
    return { name: "choose_direction", args: { direction: "clockwise" } };
  if (plan.blast && s === "sheriff_badge_choice")
    return {
      name: "choose_badge_successor",
      args: { target_id: plan.doubleBadge && q.actorId === 10 ? 5 : 6 },
    };
  if (s === "alchemist_snake")
    return { name: "use_snake", args: { target_id: plan.snake[index]! } };
  if (s === "day_speech" || s === "last_words" || (plan.blast && s === "sheriff_campaign_speech"))
    return { name: "speak", args: { text: "Words" } };
  if (s === "voting") {
    if (variant === "blast-last-wolf" && d === 2)
      return { name: "vote", args: { target_id: null, abstain: true } };
    const target = plan.exile[index]!;
    return {
      name: "vote",
      args: { target_id: q.actorId === target ? null : target, abstain: q.actorId === target },
    };
  }
  return null;
}
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
          boardConfig: config,
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
                                game.world.getComponent<BadgeComponent>(id, COMPONENT.Badge)
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
