import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { bootstrapGame } from "../../src/app/bootstrap";
import { createRandom, type ActionRequest, type ToolCall } from "../../src/core";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../src/runtime/simulation/reproduction_context";
import { replayReproduction } from "../../src/runtime/simulation/replay_reproduction";
import {
  parseReproductionRecord,
  type ReproductionRecord,
  type RecordedCheckpoint,
} from "../../src/recording/reproduction";
import { validateMagicianRecord } from "../../src/recording/magician_record";
import { GameEventRecorder } from "../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../support/temp_directory";
import { magicianScenario } from "../support/magician_transport_scenarios";
const records = new Map<string, Promise<ReproductionRecord>>();
let version: ReturnType<typeof currentEngineVersion> | undefined;
function recording(policy: "original" | "exchanged"): Promise<ReproductionRecord> {
  let result = records.get(policy);
  if (result) return result;
  result = (async () => {
    const scenario = magicianScenario(policy),
      config = scenario.board.config,
      locale = "en" as const;
    const context = bootstrapGame(config, { locale, random: createRandom(scenario.seed) });
    const plans = new Map([...scenario.turns].map(([id, turns]) => [id, [...turns]]));
    const root = await createTestTempDirectory("awa-magician-tape-");
    try {
      const manager = await SessionRecordManager.create(
        {
          sessionId: "game",
          board: "magician_twelve",
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
          const turn = plans.get(r.actorId)?.shift();
          expect(turn?.day).toBe(r.context.day);
          expect(turn?.stage).toBe(r.context.stage);
          if (!turn) throw new Error("magician_plan_exhausted");
          return turn.action;
        },
      };
      await runWithSessionRecorder(manager, async () => {
        const trace = beginGameReproduction(manager, context, {
          engine: await (version ??= currentEngineVersion()),
          boardId: "magician_twelve",
          boardConfig: config,
          locale,
          maxDays: 8,
        });
        for (let cycle = 1; cycle <= 8 && !context.phaseManager.getSnapshot().gameOver; cycle++) {
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
        expect(snapshot.result!.winner).toBe(scenario.winner);
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
      const record = parseReproductionRecord(
        JSON.parse(await fs.readFile(manager.sessionDir + "/reproduction.json", "utf8")),
      );
      const replay = await replayReproduction(record, root);
      expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
      return record;
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  })();
  records.set(policy, result);
  return result;
}
for (const policy of ["original", "exchanged"] as const)
  test(
    "Magician complete native Tape replay/" + policy,
    async () => {
      await recording(policy);
    },
    120000,
  );
const mutations: Array<[string, (r: ReproductionRecord) => void]> = [
  [
    "duplicate pair",
    (r) => {
      const e = r.events.find((e) => e.type === "magician_exchange_committed")!;
      e.payload.pair = [1, 1];
    },
  ],
  [
    "missing private audience",
    (r) => {
      delete r.events.find((e) => e.type === "magician_exchange_committed")!.audience;
    },
  ],
  [
    "wrong actor",
    (r) => {
      r.events.find((e) => e.type === "magician_exchange_committed")!.payload.actorId = 999;
    },
  ],
  [
    "future exchange",
    (r) => {
      r.events.find((e) => e.type === "magician_exchange_committed")!.payload.day = 99;
    },
  ],
  [
    "checkpoint history reset",
    (r) => {
      const p = r.checkpoints.at(-1)!.players.find((p) => p.role === "magician")!;
      (p.privateState.magician as { history: unknown[] }).history = [];
    },
  ],
  [
    "wrong policy",
    (r) => {
      r.metadata.normalizedBoard.magician!.deathShotTargetPolicy = "original";
    },
  ],
  [
    "invalid source qualification",
    (r) => {
      r.decisions.find((d) => d.stage === "death_shot")!.request.context.death_sources = [
        "poison" as never,
      ];
    },
  ],
  [
    "invented candidate",
    (r) => {
      const context = r.decisions.find((d) => d.stage === "magician_exchange")!.request.context;
      context.swap_candidates = [...context.swap_candidates!, 999];
    },
  ],
  [
    "miss payload leak",
    (r) => {
      r.events.find((e) => e.type === "death_shot_missed")!.payload.targetId = 1;
    },
  ],
  [
    "refreshed king gun",
    (r) => {
      const p = r.checkpoints.at(-1)!.players.find((p) => p.role === "wolf_king")!;
      (p.privateState.wolf_king as { canShoot: boolean }).canShoot = true;
    },
  ],
  [
    "removed required pass",
    (r) => {
      const index = r.events.findIndex(
        (e) => e.type === "magician_exchange_committed" && e.payload.day === 2,
      );
      expect(index).toBeGreaterThan(-1);
      r.events.splice(index, 1);
      r.decisions = r.decisions.filter((d) => !(d.stage === "magician_exchange" && d.day === 2));
      for (const cp of r.checkpoints) {
        if (cp.eventCount > index) cp.eventCount--;
        for (const p of cp.players)
          if (p.role === "magician") {
            const s = p.privateState.magician as { history: Array<{ day: number }> };
            s.history = s.history.filter((h) => h.day !== 2);
          }
      }
    },
  ],
  [
    "deleted miss receipt",
    (r) => {
      const index = r.events.findIndex((e) => e.type === "death_shot_missed");
      expect(index).toBeGreaterThan(-1);
      r.events.splice(index, 1);
      for (const cp of r.checkpoints) if (cp.eventCount > index) cp.eventCount--;
      for (const d of r.decisions)
        d.request.context.visible_events = d.request.context.visible_events.filter(
          (e) => e.type !== "death_shot_missed",
        );
    },
  ],
  [
    "deleted night settlement",
    (r) => {
      const index = r.events.findIndex((e) => e.type === "night_resolved");
      expect(index).toBeGreaterThan(-1);
      r.events.splice(index, 1);
      for (const cp of r.checkpoints) if (cp.eventCount > index) cp.eventCount--;
    },
  ],
  [
    "revived checkpoint",
    (r) => {
      r.checkpoints.at(-1)!.players.find((p) => p.role === "wolf_king")!.alive = true;
    },
  ],
];
for (const [name, mutate] of mutations)
  test(
    "Magician Tape rejects " + name,
    async () => {
      const record = structuredClone(await recording("exchanged"));
      mutate(record);
      expect(() => validateMagicianRecord(record)).toThrow("reproduction_magician_state_invalid");
    },
    120000,
  );
