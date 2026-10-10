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
import { validateOrderPrinceRecord } from "../../src/recording/order_prince_record";
import { GameEventRecorder } from "../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../support/temp_directory";
import { orderPrinceScenario } from "../support/order_prince_transport_scenarios";
const records = new Map<string, Promise<ReproductionRecord>>();
let version: ReturnType<typeof currentEngineVersion> | undefined;
function recording(policy: "day1" | "day2" | "pk"): Promise<ReproductionRecord> {
  let result = records.get(policy);
  if (result) return result;
  result = (async () => {
    const scenario = orderPrinceScenario(policy),
      config = scenario.board.config,
      locale = "en" as const;
    const context = bootstrapGame(config, { locale, random: createRandom(scenario.seed) });
    const plans = new Map([...scenario.turns].map(([id, turns]) => [id, [...turns]]));
    const root = await createTestTempDirectory("awa-order-prince-tape-");
    try {
      const manager = await SessionRecordManager.create(
        {
          sessionId: "game",
          board: "order_prince_twelve",
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
          if (!turn) throw new Error("order_prince_plan_exhausted");
          return turn.action;
        },
      };
      await runWithSessionRecorder(manager, async () => {
        const trace = beginGameReproduction(manager, context, {
          engine: await (version ??= currentEngineVersion()),
          boardId: "order_prince_twelve",
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
for (const policy of ["day1", "day2", "pk"] as const)
  test(
    "Order Prince complete native Tape replay/" + policy,
    async () => {
      await recording(policy);
    },
    120000,
  );

const mutations: Array<[string, (r: ReproductionRecord) => void]> = [
  [
    "missing audience",
    (r) => {
      delete r.events.find((e) => e.type === "order_prince_choice_committed")!.audience;
    },
  ],
  [
    "overexposed choice",
    (r) => {
      r.events.find((e) => e.type === "order_prince_choice_committed")!.audience = [1, 2];
    },
  ],
  [
    "wrong actor",
    (r) => {
      r.events.find((e) => e.type === "order_prince_choice_committed")!.payload.actorId = 999;
    },
  ],
  [
    "future day",
    (r) => {
      r.events.find((e) => e.type === "order_prince_choice_committed")!.payload.day = 99;
    },
  ],
  [
    "altered activation",
    (r) => {
      r.events.find((e) => e.type === "order_prince_choice_committed")!.payload.activate = false;
    },
  ],
  [
    "reset stock",
    (r) => {
      const p = r.checkpoints.at(-1)!.players.find((p) => p.role === "order_prince")!;
      (p.privateState.orderPrince as { history: unknown[] }).history = [];
    },
  ],
  [
    "new identity",
    (r) => {
      r.checkpoints.at(-1)!.players.find((p) => p.role === "order_prince")!.name = "tampered";
    },
  ],
  [
    "fabricated old exile",
    (r) => {
      const prince = r.metadata.players.find((p) => p.role === "order_prince")!.id;
      r.events.find((e) => e.type === "voted_out")!.payload.target = prince;
    },
  ],
  [
    "allowed fallback",
    (r) => {
      r.decisions.find((d) => d.stage === "order_prince_revote")!.request.context.allow_fallback =
        true;
    },
  ],
  [
    "public reset hidden",
    (r) => {
      r.events.find((e) => e.type === "order_prince_revote_started")!.audience = [1];
    },
  ],
  [
    "duplicate choice",
    (r) => {
      const i = r.events.findIndex((e) => e.type === "order_prince_choice_committed");
      r.events.splice(i, 0, structuredClone(r.events[i]!));
      for (const c of r.checkpoints) if (c.eventCount > i) c.eventCount++;
    },
  ],
  [
    "deleted public reset",
    (r) => {
      const i = r.events.findIndex((e) => e.type === "order_prince_revote_started");
      r.events.splice(i, 1);
      for (const c of r.checkpoints) if (c.eventCount > i) c.eventCount--;
      for (const d of r.decisions)
        d.request.context.visible_events = d.request.context.visible_events.filter(
          (e) => e.type !== "order_prince_revote_started",
        );
    },
  ],
];
for (const [name, mutate] of mutations)
  test(
    "Order Prince Tape rejects " + name,
    async () => {
      const r = structuredClone(await recording("day1"));
      mutate(r);
      expect(() => validateOrderPrinceRecord(r)).toThrow("reproduction_order_prince_invalid");
    },
    120000,
  );

test("Order Prince Tape rejects an altered revote decision", async () => {
  const r = structuredClone(await recording("day1"));
  const d = r.decisions.find(
    (d) =>
      d.stage === "order_prince_revote" &&
      d.outcome.kind === "action" &&
      d.outcome.action?.name === "vote" &&
      !d.outcome.action.args.abstain,
  )!;
  d.outcome = {
    kind: "action",
    action: { name: "vote", args: { target_id: null, abstain: true } },
  };
  expect(() => validateOrderPrinceRecord(r)).toThrow("reproduction_order_prince_invalid");
}, 120000);
test("Order Prince Tape rejects forged weight even on the voided ballot", async () => {
  const r = structuredClone(await recording("day1"));
  const e = r.events.find((e) => e.type === "vote_cast" && e.payload.abstain === false)!;
  e.payload.weight = 99;
  expect(() => validateOrderPrinceRecord(r)).toThrow("reproduction_order_prince_invalid");
}, 120000);

test("Order Prince accepts and replays sanitized legal skill speech", async () => {
  const r = structuredClone(await recording("day1"));
  const d = r.decisions.find((d) => d.stage === "order_prince_speech")!;
  if (d.outcome.kind !== "action" || d.outcome.action?.name !== "speak")
    throw new Error("missing_speech");
  d.outcome.action.args.text = " [Judge]  " + d.outcome.action.args.text + " ";
  expect(() => validateOrderPrinceRecord(r)).not.toThrow();
  const root = await createTestTempDirectory("awa-order-prince-sanitized-");
  try {
    const replay = await replayReproduction(parseReproductionRecord(r), root);
    expect(replay.snapshot).toEqual(r.checkpoints.at(-1)!.snapshot);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}, 120000);

for (const variant of ["day1", "pk"] as const)
  test(
    "Order Prince rejects omitted completed-round receipt/" + variant,
    async () => {
      const r = structuredClone(await recording(variant));
      const start = r.events.findIndex(
        (e) => e.type === (variant === "pk" ? "exile_pk_started" : "order_prince_revote_started"),
      );
      const i = r.events.findIndex(
        (e, index) =>
          index > start &&
          e.type === "vote_cast" &&
          (variant === "pk" || e.payload.abstain === true),
      );
      expect(i).toBeGreaterThan(start);
      const removed = r.events[i]!;
      const summary = r.events.find((e, index) => index > i && e.type === "vote_summary")!;
      const ballots = summary.payload.votes as Array<{
        actorId: number;
        targetId: number | null;
        abstain: boolean;
        weight: number;
      }>;
      summary.payload.votes = ballots.filter((v) => v.actorId !== removed.payload.actorId);
      const tally: Record<string, number> = {};
      for (const v of summary.payload.votes as typeof ballots)
        if (!v.abstain && v.targetId !== null)
          tally[v.targetId] = (tally[v.targetId] ?? 0) + v.weight;
      summary.payload.tally = tally;
      r.events.splice(i, 1);
      for (const c of r.checkpoints) if (c.eventCount > i) c.eventCount--;
      expect(() => validateOrderPrinceRecord(r)).toThrow("reproduction_order_prince_invalid");
    },
    120000,
  );

for (const mode of ["alter", "delete"] as const)
  test(
    "Order Prince rejects missing or altered PK speech/" + mode,
    async () => {
      const r = structuredClone(await recording("pk"));
      const start = r.events.findIndex((e) => e.type === "exile_pk_started");
      const i = r.events.findIndex((e, index) => index > start && e.type === "day_speech");
      expect(i).toBeGreaterThan(start);
      if (mode === "alter") r.events[i]!.payload.text = "fabricated speech";
      else {
        r.events.splice(i, 1);
        for (const c of r.checkpoints) if (c.eventCount > i) c.eventCount--;
      }
      expect(() => validateOrderPrinceRecord(r)).toThrow("reproduction_order_prince_invalid");
    },
    120000,
  );
