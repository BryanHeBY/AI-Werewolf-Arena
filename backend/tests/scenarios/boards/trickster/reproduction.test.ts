/**
 * 场景测试验证诡术师录制与独立核验中的放逐目标映射、取消和来源回执。
 * 输入为固定原生动作的真实对局、两种语言及独立删除的映射／checkpoint 证据。
 * 输出以手写实际放逐／终局结果及缺失或错误映射回执的严格拒绝作为独立预期。
 * 不调用计费模型，不改写 fixture 或 Tape 的预期字节。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { createRandom, type ActionRequest, type ToolCall } from "../../../../src/core";
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
  type ReproductionRecord,
  type RecordedCheckpoint,
} from "../../../../src/recording/reproduction";

import { GameEventRecorder } from "../../../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { tricksterTwelveConfig } from "../../../../src/runtime/scenarios/trickster_twelve";
import { ObservedBot } from "../../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
import { randomDraws } from "../../../../src/core";
import { validateTricksterRecord } from "../../../../src/verification/reproduction/trickster/validate";
const records = new Map<string, Promise<ReproductionRecord>>();
let version: ReturnType<typeof currentEngineVersion> | undefined;
function recording(locale: "en" | "zh-CN", cancel: boolean, seed = 0): Promise<ReproductionRecord> {
  const policy = locale + ":" + cancel + ":" + seed;
  let result = records.get(policy);
  if (result) return result;
  result = (async () => {
    const config = structuredClone(tricksterTwelveConfig);
    const random = createRandom("trickster-tape:" + policy);
    const context = bootstrapGame(config, { locale, random });
    const strategies = new Map(
      context.playerIds.map((id) => [
        id,
        new ObservedBot(randomDraws(random.fork("players").fork("id:" + id)), "active"),
      ]),
    );
    const native = new ObservedPlayersActionProvider(context.world, strategies);
    const chosen = new Map<number, [number, number]>();
    const root = await createTestTempDirectory("awa-trickster-tape-");
    try {
      const manager = await SessionRecordManager.create(
        {
          sessionId: "game",
          board: "trickster_twelve",
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
          if (cancel && r.context.stage === "trickster_exchange") {
            const pair = chosen.get(r.context.day);
            if (pair && pair.every((id) => r.context.trickster_candidates!.includes(id)))
              return {
                name: "swap_exile_targets",
                args: { first_id: pair[1], second_id: pair[0], abstain: false },
              };
          }
          return native.getAction(r);
        },
      };
      await runWithSessionRecorder(manager, async () => {
        const trace = beginGameReproduction(manager, context, {
          engine: await (version ??= currentEngineVersion()),
          boardId: "trickster_twelve",
          ...(void config, {}),
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

for (const locale of ["en", "zh-CN"] as const)
  for (const cancel of [false, true])
    test(
      "Trickster complete native Tape and replay/" + locale + "/" + cancel,
      async () => {
        await recording(locale, cancel);
      },
      120000,
    );
const mutations: Array<[string, (r: ReproductionRecord) => void]> = [
  [
    "missing private audience",
    (r) => {
      delete r.events.find((e) => e.type === "trickster_exchange_committed")!.audience;
    },
  ],
  [
    "duplicate pair",
    (r) => {
      r.events.find((e) => e.type === "trickster_exchange_committed")!.payload.pair = [1, 1];
    },
  ],
  [
    "wrong actor",
    (r) => {
      r.events.find((e) => e.type === "trickster_exchange_committed")!.payload.actorId = 999;
    },
  ],
  [
    "future choice",
    (r) => {
      r.events.find((e) => e.type === "trickster_exchange_committed")!.payload.day = 999;
    },
  ],
  [
    "invented candidate",
    (r) => {
      const c = r.decisions.find((d) => d.stage === "trickster_exchange")!.request.context;
      c.trickster_candidates = [...c.trickster_candidates!, 999];
    },
  ],
  [
    "missing pass contract",
    (r) => {
      delete r.decisions.find((d) => d.stage === "trickster_exchange")!.request.context
        .trickster_may_pass;
    },
  ],
  [
    "checkpoint history reset",
    (r) => {
      const p = r.checkpoints.at(-1)!.players.find((p) => p.role === "trickster")!;
      (p.privateState.trickster as { history: unknown[] }).history = [];
    },
  ],
  [
    "cross-player private choice",
    (r) => {
      const e = r.events.find((e) => e.type === "trickster_exchange_committed")!;
      const d = r.decisions.find((d) => d.actorId !== e.payload.actorId)!;
      d.request.context.visible_events = [
        ...d.request.context.visible_events,
        { type: e.type, payload: e.payload } as never,
      ];
    },
  ],
];
for (const [name, mutate] of mutations)
  test(
    "Trickster Tape rejects " + name,
    async () => {
      const r = structuredClone(await recording("en", false));
      mutate(r);
      expect(() => validateTricksterRecord(r)).toThrow("reproduction_trickster_invalid");
    },
    120000,
  );
test("Trickster Tape rejects wrong effective exile and deleted mapping receipt", async () => {
  let source: ReproductionRecord | undefined;
  for (let seed = 0; seed < 8; seed++) {
    const r = await recording("en", false, seed);
    if (r.events.some((e) => e.type === "exile_target_mapped")) {
      source = r;
      break;
    }
  }
  expect(source).toBeDefined();
  if (!source) throw new Error("mapping_fixture_missing");
  const wrong = structuredClone(source),
    e = wrong.events.find((e) => e.type === "exile_target_mapped")!;
  e.payload.effectiveId = 999;
  expect(() => parseReproductionRecord(wrong)).toThrow();
  const missing = structuredClone(source),
    index = missing.events.findIndex((e) => e.type === "exile_target_mapped");
  const removed = missing.events.splice(index, 1)[0]!;
  for (const cp of missing.checkpoints) if (cp.eventCount > index) cp.eventCount--;
  for (const d of missing.decisions)
    d.request.context.visible_events = d.request.context.visible_events.filter(
      (e) =>
        !(e.type === removed.type && JSON.stringify(e.payload) === JSON.stringify(removed.payload)),
    );
  expect(() => parseReproductionRecord(missing)).toThrow();
}, 120000);
