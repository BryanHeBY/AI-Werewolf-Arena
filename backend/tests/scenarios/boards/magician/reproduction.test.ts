/**
 * Magician recording/verifier scenarios verify target exchange, night gun and resource chronology.
 * Input: Actual fixed-action game records, explicit policies and independent causal/inventory mutants.
 * Output and independent oracle: Handwritten native outcomes and rejected coherent altered decision/checkpoint tapes.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { createRandom, PotionType, type ActionRequest, type ToolCall } from "../../../../src/core";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/runtime/simulation/reproduction_context";
import { replayReproduction } from "../../../../src/runtime/simulation/replay_reproduction";
import {
  parseReproductionRecord,
  ReproductionTrace,
  type ReproductionRecord,
  type RecordedCheckpoint,
} from "../../../../src/recording/reproduction";
import { validateMagicianRecord } from "../../../../src/recording/magician_record";
import { GameEventRecorder } from "../../../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { magicianScenario } from "../../../support/magician_transport_scenarios";
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

type NativeAuditStock = {
  uses: number;
  lastUsedDay: number | null;
  state: Record<string, unknown>;
};
function nativeAuditStock(
  r: ReproductionRecord,
  kind: "seer" | "witch",
  cycle?: number,
): NativeAuditStock {
  const cp =
    cycle === undefined ? r.checkpoints.at(-1)! : r.checkpoints.find((cp) => cp.cycle === cycle)!;
  const player = cp.players.find((p) => p.role === kind)!;
  return (player.privateState.abilities as Record<string, NativeAuditStock>)[
    kind === "seer" ? "native:seer_check" : "native:potion"
  ]!;
}
for (const [name, mutate] of [
  [
    "poison stock",
    (r: ReproductionRecord) => {
      nativeAuditStock(r, "witch").state.poison = 1;
    },
  ],
  [
    "potion use count",
    (r: ReproductionRecord) => {
      nativeAuditStock(r, "witch").uses = 0;
    },
  ],
  [
    "seer history",
    (r: ReproductionRecord) => {
      nativeAuditStock(r, "seer").state.history = [];
    },
  ],
  [
    "seer camp fact",
    (r: ReproductionRecord) => {
      const e = r.events.find((e) => e.type === "seer_checked")!;
      e.payload.isWerewolf = !e.payload.isWerewolf;
    },
  ],
] as const)
  test(
    "Magician independent native inventory rejects " + name,
    async () => {
      const r = structuredClone(await recording("exchanged"));
      mutate(r);
      expect(() => validateMagicianRecord(r)).toThrow("reproduction_magician_state_invalid");
    },
    120000,
  );
for (const kind of ["seer", "witch"] as const)
  test(
    "Magician independent native ledger requires a complete night turn/" + kind,
    async () => {
      const r = structuredClone(await recording("exchanged"));
      const decision = r.decisions.find((d) => d.day === 2 && d.stage === kind)!;
      expect(decision).toBeDefined();
      const type = kind === "seer" ? "seer_checked" : "witch_potion_skipped";
      const all = r.events.flatMap((e, index) => (e.type === type ? [index] : [])),
        index = all[all.length - 1]!;
      expect(index).toBeGreaterThan(0);
      // Witch has used poison on N1; the N2 record is a real explicit none.
      if (kind === "witch")
        expect(decision.outcome).toMatchObject({
          kind: "action",
          action: { name: "use_potion", args: { potion_type: "none" } },
        });
      r.decisions = r.decisions.filter((d) => d !== decision);
      const [removedEvent] = r.events.splice(index, 1);
      const before = structuredClone(nativeAuditStock(r, kind, 1));
      if (kind === "witch") {
        before.state.healUsedThisNight = false;
        before.state.poisonUsedThisNight = false;
      }
      for (const cp of r.checkpoints) {
        if (cp.eventCount > index) cp.eventCount--;
        if (cp.cycle < 2) continue;
        const p = cp.players.find((p) => p.role === kind)!;
        (p.privateState.abilities as Record<string, NativeAuditStock>)[
          kind === "seer" ? "native:seer_check" : "native:potion"
        ] = structuredClone(before);
      }
      for (const d of r.decisions)
        d.request.context.visible_events = d.request.context.visible_events
          .filter(
            (e) =>
              e.type !== removedEvent!.type ||
              JSON.stringify(e.payload) !== JSON.stringify(removedEvent!.payload),
          )
          .map((e, i) => ({ ...e, seq: i + 1 }));
      expect(() => validateMagicianRecord(r)).toThrow("reproduction_magician_state_invalid");
    },
    120000,
  );

/** Actual pipeline and trace, failing after a real native turn; no transport timing needed. */
async function nativeFailurePrefix(boundary: "seer" | "sheriff_nomination") {
  const day = boundary === "seer" ? 2 : 1;
  const scenario = magicianScenario("exchanged");
  const context = bootstrapGame(scenario.board.config, {
    locale: "en",
    random: createRandom(scenario.seed),
  });
  const trace = new ReproductionTrace((await recording("exchanged")).metadata, () => {});
  const checkpoint = (cycle: number, complete: boolean) =>
    trace.checkpoint(
      captureCheckpoint(
        context.world,
        context.phaseManager.getSnapshot(),
        cycle,
        complete,
        context.phaseManager.getEvents().length,
        new Error("fixture_native_prefix"),
      ),
      context.phaseManager.getEvents(),
    );
  checkpoint(0, true);
  const turns = new Map([...scenario.turns].map(([id, rows]) => [id, [...rows]]));
  let incremental: ReproductionRecord | undefined;
  const provider = {
    async getAction(request: ActionRequest): Promise<ToolCall | null> {
      const turn = turns.get(request.actorId)?.shift();
      expect(turn?.day).toBe(request.context.day);
      expect(turn?.stage).toBe(request.context.stage);
      if (request.context.day === day && request.context.stage === boundary) {
        incremental = structuredClone(trace.build());
        throw new Error("fixture_native_prefix");
      }
      // The event-branch example needs an explicit none without a poison checkpoint side effect.
      if (boundary === "sheriff_nomination" && request.context.stage === "witch")
        return {
          name: "use_potion",
          args: { target_id: request.actorId, potion_type: PotionType.None },
        };
      return turn!.action;
    },
  };
  for (let cycle = 1; cycle <= day; cycle++) {
    try {
      await context.phaseManager.runSingleCycle({ getAction: (r) => trace.decide(r, provider) }, 8);
      checkpoint(cycle, true);
    } catch (error) {
      expect(String(error)).toContain("fixture_native_prefix");
      checkpoint(cycle, false);
      break;
    }
  }
  const record = structuredClone(trace.build());
  expect(record.checkpoints.at(-1)!.complete).toBe(false);
  expect(record.events.filter((e) => e.type === "night_resolved")).toHaveLength(day - 1);
  return { record, incremental: incremental! };
}

function eraseNativeTurn(record: ReproductionRecord, day: number) {
  const witch = record.metadata.players.find((p) => p.role === "witch")!.id;
  const removed = record.decisions.find((d) => d.day === day && d.stage === "witch")!;
  expect(removed.outcome).toMatchObject({
    kind: "action",
    action: { name: "use_potion", args: { potion_type: "none" } },
  });
  record.decisions = record.decisions.filter((d) => d !== removed);
  const eventIndex = record.events.findIndex(
    (e) => e.type === "witch_potion_skipped" && e.payload.actorId === witch,
  );
  expect(eventIndex).toBeGreaterThan(0);
  const [event] = record.events.splice(eventIndex, 1);
  const stock = structuredClone(nativeAuditStock(record, "witch", day - 1));
  stock.state.healUsedThisNight = false;
  stock.state.poisonUsedThisNight = false;
  for (const cp of record.checkpoints) {
    if (cp.eventCount > eventIndex) cp.eventCount--;
    if (cp.cycle < day) continue;
    const player = cp.players.find((p) => p.id === witch)!;
    (player.privateState.abilities as Record<string, NativeAuditStock>)["native:potion"] =
      structuredClone(stock);
  }
  for (const d of record.decisions) {
    if (d.openedAfterSettlement >= removed.settleOrder!) d.openedAfterSettlement--;
    if (d.settleOrder !== undefined && d.settleOrder > removed.settleOrder!) d.settleOrder--;
    d.request.context.visible_events = d.request.context.visible_events
      .filter(
        (e) =>
          e.type !== event!.type || JSON.stringify(e.payload) !== JSON.stringify(event!.payload),
      )
      .map((e, i) => ({ ...e, seq: i + 1 }));
  }
}

for (const boundary of ["seer", "sheriff_nomination"] as const)
  test(
    "native failed prefix rejects deleting both a committed Witch turn and its fact/" + boundary,
    async () => {
      const { record } = await nativeFailurePrefix(boundary);
      expect(() => validateMagicianRecord(record)).not.toThrow();
      const day = boundary === "seer" ? 2 : 1;
      expect(record.events.filter((e) => e.type === "seer_checked")).toHaveLength(1);
      eraseNativeTurn(record, day);
      expect(() => validateMagicianRecord(record)).toThrow("reproduction_magician_state_invalid");
    },
    120000,
  );

test("native requests are independently checked before current-night events are checkpointed", async () => {
  const { incremental } = await nativeFailurePrefix("seer");
  expect(incremental.checkpoints.at(-1)!.cycle).toBe(1);
  expect(incremental.decisions.find((d) => d.day === 2 && d.stage === "seer")!.outcome.kind).toBe(
    "pending",
  );
  expect(() => validateMagicianRecord(incremental)).not.toThrow();
  const mutations = [
    (r: ReproductionRecord) => {
      r.decisions = r.decisions.filter((d) => d.day !== 2 || d.stage !== "witch");
    },
    (r: ReproductionRecord) => {
      r.decisions.find((d) => d.day === 2 && d.stage === "witch")!.outcome = {
        kind: "error",
        code: "decision_failed",
        name: "Error",
      };
    },
    (r: ReproductionRecord) => {
      const d = r.decisions.find((d) => d.day === 2 && d.stage === "seer")!;
      d.openedAfterSettlement = 0;
    },
    (r: ReproductionRecord) => {
      const d = r.decisions.find((d) => d.day === 2 && d.stage === "seer")!;
      d.actorId = d.request.actorId = r.metadata.players.find((p) => p.role === "villager")!.id;
    },
    (r: ReproductionRecord) => {
      const d = r.decisions.find((d) => d.day === 2 && d.stage === "seer")!;
      d.request.allowedTools = ["use_potion"];
    },
    (r: ReproductionRecord) => {
      r.decisions.push(
        structuredClone(r.decisions.find((d) => d.day === 2 && d.stage === "seer")!),
      );
    },
  ];
  for (const mutate of mutations) {
    const altered = structuredClone(incremental);
    mutate(altered);
    expect(() => validateMagicianRecord(altered)).toThrow("reproduction_magician_state_invalid");
  }
}, 120000);

test("first sheriff failure cannot hide the Seer's already completed night turn", async () => {
  const { record, incremental } = await nativeFailurePrefix("sheriff_nomination");
  expect(() => validateMagicianRecord(record)).not.toThrow();
  expect(() => validateMagicianRecord(incremental)).not.toThrow();
  const removed = record.decisions.find((d) => d.day === 1 && d.stage === "seer")!;
  const eventIndex = record.events.findIndex((e) => e.type === "seer_checked");
  expect(eventIndex).toBeGreaterThan(0);
  const [event] = record.events.splice(eventIndex, 1);
  record.decisions = record.decisions.filter((d) => d !== removed);
  const seer = record.metadata.players.find((p) => p.role === "seer")!.id;
  const initial = record.checkpoints[0]!.players.find((p) => p.id === seer)!.privateState;
  for (const cp of record.checkpoints) {
    if (cp.eventCount > eventIndex) cp.eventCount--;
    if (cp.cycle > 0)
      cp.players.find((p) => p.id === seer)!.privateState = structuredClone(initial);
  }
  for (const d of record.decisions) {
    if (d.openedAfterSettlement >= removed.settleOrder!) d.openedAfterSettlement--;
    if (d.settleOrder !== undefined && d.settleOrder > removed.settleOrder!) d.settleOrder--;
    d.request.context.visible_events = d.request.context.visible_events
      .filter(
        (e) =>
          e.type !== event!.type || JSON.stringify(e.payload) !== JSON.stringify(event!.payload),
      )
      .map((e, i) => ({ ...e, seq: i + 1 }));
  }
  expect(() => validateMagicianRecord(record)).toThrow("reproduction_magician_state_invalid");
  expect(() => parseReproductionRecord(record)).toThrow("reproduction_magician_state_invalid");
  for (const mutate of [
    (r: ReproductionRecord) => {
      r.decisions = r.decisions.filter((d) => d.stage !== "seer");
    },
    (r: ReproductionRecord) => {
      r.decisions.find((d) => d.stage === "seer")!.outcome = {
        kind: "error",
        code: "decision_failed",
        name: "Error",
      };
    },
    (r: ReproductionRecord) => {
      r.decisions.find((d) => d.stage === "sheriff_nomination")!.openedAfterSettlement = 0;
    },
  ]) {
    const altered = structuredClone(incremental);
    mutate(altered);
    expect(() => validateMagicianRecord(altered)).toThrow("reproduction_magician_state_invalid");
  }
}, 120000);
