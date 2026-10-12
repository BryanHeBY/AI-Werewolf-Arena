/**
 * Wolf Sorcerer recording/verifier scenarios verify seat exchange, first-night policies and erased Psychic facts.
 * Input: Actual fixed-action games, cancellation variants and coherent independently rolled-back record mutants.
 * Output and independent oracle: Manual causal/resource/terminal outcomes and strict rejection of erased or remapped inspection evidence.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { validateWolfSorcererRecord } from "../../src/recording/wolf_sorcerer_record";
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

import { GameEventRecorder } from "../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../support/drivers/temp-directories";
import { wolfSorcererTwelveConfig } from "../../src/runtime/scenarios/wolf_sorcerer_twelve";
import { ObservedBot } from "../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../src/ai/agents/providers/observed_players";
import { randomDraws } from "../../src/core";
const records = new Map<string, Promise<ReproductionRecord>>();
let version: ReturnType<typeof currentEngineVersion> | undefined;
function recording(
  locale: "en" | "zh-CN",
  cancel: boolean,
  seed = 0,
  firstNight: 1 | 2 = 1,
): Promise<ReproductionRecord> {
  const policy = locale + ":" + cancel + ":" + seed + ":" + firstNight;
  let result = records.get(policy);
  if (result) return result;
  result = (async () => {
    const config = structuredClone(wolfSorcererTwelveConfig);
    config.wolfSorcerer!.firstNight = firstNight;
    config.magician!.firstNight = firstNight;
    const random = createRandom("wolf_sorcerer-tape:" + policy);
    const context = bootstrapGame(config, { locale, random });
    const strategies = new Map(
      context.playerIds.map((id) => [
        id,
        new ObservedBot(randomDraws(random.fork("players").fork("id:" + id)), "active"),
      ]),
    );
    const native = new ObservedPlayersActionProvider(context.world, strategies, config);
    const chosen = new Map<number, [number, number]>();
    const root = await createTestTempDirectory("awa-wolf_sorcerer-tape-");
    try {
      const manager = await SessionRecordManager.create(
        {
          sessionId: "game",
          board: "wolf_sorcerer_twelve",
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
          if (cancel && r.context.stage === "magician_exchange") {
            const candidates = r.context.swap_candidates!;
            const pair: [number, number] = [candidates[0]!, candidates[1]!];
            chosen.set(r.context.day, pair);
            return {
              name: "swap_targets",
              args: { first_id: pair[0], second_id: pair[1], abstain: false },
            };
          }
          if (cancel && r.context.stage === "wolf_sorcerer_exchange") {
            const pair = chosen.get(r.context.day);
            if (pair && pair.every((id) => r.context.sorcerer_candidates!.includes(id)))
              return {
                name: "swap_night_seats",
                args: { first_id: pair[1], second_id: pair[0], abstain: false },
              };
          }
          return native.getAction(r);
        },
      };
      await runWithSessionRecorder(manager, async () => {
        const trace = beginGameReproduction(manager, context, {
          engine: await (version ??= currentEngineVersion()),
          boardId: "wolf_sorcerer_twelve",
          boardConfig: config,
          locale,
          maxDays: 30,
        });
        for (let cycle = 1; cycle <= 30 && !context.phaseManager.getSnapshot().gameOver; cycle++) {
          await context.phaseManager.runSingleCycle(
            { getAction: (r) => trace.decide(r, provider) },
            30,
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

for (const firstNight of [1, 2] as const)
  for (const locale of ["en", "zh-CN"] as const)
    for (const cancel of [false, true])
      test(
        "WolfSorcerer complete native Tape and replay/" + firstNight + "/" + locale + "/" + cancel,
        async () => {
          await recording(locale, cancel, 0, firstNight);
        },
        120000,
      );

const mutations: Array<[string, (r: ReproductionRecord) => void]> = [
  [
    "missing private audience",
    (r) => {
      delete r.events.find((e) => e.type === "wolf_sorcerer_exchange_committed")!.audience;
    },
  ],
  [
    "duplicate pair",
    (r) => {
      r.events.find((e) => e.type === "wolf_sorcerer_exchange_committed")!.payload.pair = [1, 1];
    },
  ],
  [
    "wrong actor",
    (r) => {
      r.events.find((e) => e.type === "wolf_sorcerer_exchange_committed")!.payload.actorId = 999;
    },
  ],
  [
    "future choice",
    (r) => {
      r.events.find((e) => e.type === "wolf_sorcerer_exchange_committed")!.payload.day = 999;
    },
  ],
  [
    "invented candidate",
    (r) => {
      const c = r.decisions.find((d) => d.stage === "wolf_sorcerer_exchange")!.request.context;
      c.sorcerer_candidates = [...c.sorcerer_candidates!, 999];
    },
  ],
  [
    "checkpoint history reset",
    (r) => {
      const p = r.checkpoints.at(-1)!.players.find((p) => p.role === "wolf_sorcerer")!;
      (p.privateState.wolfSorcerer as { history: unknown[] }).history = [];
    },
  ],
  [
    "cross-player private choice",
    (r) => {
      const e = r.events.find((e) => e.type === "wolf_sorcerer_exchange_committed")!;
      const d = r.decisions.find((d) => d.actorId !== e.payload.actorId)!;
      d.request.context.visible_events = [
        ...d.request.context.visible_events,
        { seq: r.events.indexOf(e) + 1, type: e.type, payload: e.payload },
      ];
    },
  ],
  [
    "forged psychic result",
    (r) => {
      r.events.find((e) => e.type === "role_inspected")!.payload.result = {
        kind: "role",
        role: "werewolf_imposter",
      };
    },
  ],
  [
    "forged psychic checkpoint history",
    (r) => {
      const p = r.checkpoints.at(-1)!.players.find((p) => p.role === "psychic")!;
      const a = (p.privateState.abilities as Record<string, { state: { history: unknown[] } }>)[
        "native:role_check"
      ]!;
      a.state.history = [];
    },
  ],
];
for (const [label, mutate] of mutations)
  test(
    "Wolf Sorcerer Tape rejects " + label,
    async () => {
      const record = structuredClone(await recording("en", false));
      mutate(record);
      expect(() => parseReproductionRecord(record)).toThrow();
    },
    120000,
  );

test("Wolf Sorcerer rejects erased Psychic facts with coherently rolled-back checkpoints", async () => {
  const record = structuredClone(await recording("en", false));
  const removed = new Set(
    record.events.flatMap((e, i) =>
      e.type === "role_inspected" || e.type === "role_inspection_skipped" ? [i] : [],
    ),
  );
  expect(removed.size).toBeGreaterThan(0);
  for (const cp of record.checkpoints) {
    cp.eventCount -= [...removed].filter((i) => i < cp.eventCount).length;
    const psychic = cp.players.find((p) => p.role === "psychic")!;
    const ability = (
      psychic.privateState.abilities as Record<
        string,
        {
          state: { history: unknown[]; lastDay: number | null; lastTarget: number | null };
          uses: number;
          lastUsedDay: number | null;
        }
      >
    )["native:role_check"]!;
    ability.state.history = [];
    ability.state.lastDay = null;
    ability.state.lastTarget = null;
    ability.uses = 0;
    ability.lastUsedDay = null;
  }
  record.events = record.events.filter((_, i) => !removed.has(i));
  for (const decision of record.decisions)
    decision.request.context.visible_events = decision.request.context.visible_events.filter(
      (e) => e.type !== "role_inspected" && e.type !== "role_inspection_skipped",
    );
  expect(() => validateWolfSorcererRecord(record)).toThrow("reproduction_wolf_sorcerer_invalid");
}, 120000);
