/**
 * 复现场景测试：验证时间狼妃录制与 verifier 的反射范围、资源及独立死因。输入为固定原生对局、既有政策及明确记录／库存／死亡修改；手写资源和结果 checkpoint 及伪造因果 Tape 的拒绝为预期，不调用计费模型或重写期望归档。
 */
import { validateTimeConsortRecord } from "../../../../src/recording/time_consort_record";
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Role,
  PotionType,
  createRandom,
  type ActionRequest,
  type ToolCall,
  type RoleComponent,
} from "../../../../src/core";
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
import { timeConsortTwelveConfig } from "../../../../src/runtime/scenarios/time_consort_twelve";
import { ObservedBot } from "../../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
import { randomDraws } from "../../../../src/core";
const records = new Map<string, Promise<ReproductionRecord>>();
let version: ReturnType<typeof currentEngineVersion> | undefined;
function recording(
  locale: "en" | "zh-CN",
  scope: "whole_night" | "first_effect",
  seed = 0,
): Promise<ReproductionRecord> {
  const policy = locale + ":" + scope + ":" + seed;
  let result = records.get(policy);
  if (result) return result;
  result = (async () => {
    const config = structuredClone(timeConsortTwelveConfig);
    config.timeConsort!.reflectionScope = scope;
    const random = createRandom("time-consort-tape:" + policy);
    const context = bootstrapGame(config, { locale, random });
    const strategies = new Map(
      context.playerIds.map((id) => [
        id,
        new ObservedBot(randomDraws(random.fork("players").fork("id:" + id)), "active"),
      ]),
    );
    const native = new ObservedPlayersActionProvider(context.world, strategies, config);
    const locked = context.playerIds.find(
      (id) => context.world.getComponent(id, COMPONENT.Role)?.role === Role.Wolf,
    )!;
    const root = await createTestTempDirectory("awa-time-consort-tape-");
    try {
      const manager = await SessionRecordManager.create(
        {
          sessionId: "game",
          board: "time_consort_twelve",
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
          if (r.context.day === 1) {
            if (r.context.stage === "time_consort_lock")
              return { name: "lock_time", args: { target_id: locked, abstain: false } };
            if (r.context.stage === "guard")
              return { name: "guard", args: { target_id: locked, abstain: false } };
            if (r.context.stage === "witch")
              return {
                name: "use_potion",
                args: { target_id: locked, potion_type: PotionType.Poison },
              };
            if (r.context.stage === "seer")
              return { name: "check_identity", args: { target_id: locked } };
          }
          return native.getAction(r);
        },
      };
      await runWithSessionRecorder(manager, async () => {
        const trace = beginGameReproduction(manager, context, {
          engine: await (version ??= currentEngineVersion()),
          boardId: "time_consort_twelve",
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
  for (const scope of ["whole_night", "first_effect"] as const)
    test(
      "Consort complete native Tape and replay/" + locale + "/" + scope,
      async () => {
        const r = await recording(locale, scope);
        const reflected = r.events.filter(
          (e) => e.type === "time_consort_reflected" && e.payload.day === 1,
        );
        expect(reflected.map((e) => e.payload.kind)).toEqual(
          scope === "whole_night" ? ["guard", "poison", "check"] : ["guard"],
        );
        const inspected = r.events.find((e) => e.type === "seer_checked")!;
        expect(inspected.payload.isWerewolf).toBe(scope === "first_effect");
      },
      120000,
    );
const mutations: Array<[string, (r: ReproductionRecord) => void]> = [
  [
    "missing private audience",
    (r) => {
      delete r.events.find((e) => e.type === "time_consort_lock_committed")!.audience;
    },
  ],
  [
    "wrong actor",
    (r) => {
      r.events.find((e) => e.type === "time_consort_lock_committed")!.payload.actorId = 999;
    },
  ],
  [
    "future choice",
    (r) => {
      r.events.find((e) => e.type === "time_consort_lock_committed")!.payload.day = 999;
    },
  ],
  [
    "invented candidate",
    (r) => {
      const c = r.decisions.find((d) => d.stage === "time_consort_lock")!.request.context;
      c.consort_candidates = [...c.consort_candidates!, 999];
    },
  ],
  [
    "checkpoint charge reset",
    (r) => {
      const p = r.checkpoints.at(-1)!.players.find((p) => p.role === "time_wolf_consort")!;
      (p.privateState.timeConsort as { triggeredDay: number | null }).triggeredDay = null;
    },
  ],
  [
    "checkpoint history reset",
    (r) => {
      const p = r.checkpoints.at(-1)!.players.find((p) => p.role === "time_wolf_consort")!;
      (p.privateState.timeConsort as { history: unknown[] }).history = [];
    },
  ],
  [
    "reflection exposed",
    (r) => {
      const e = r.events.find((e) => e.type === "time_consort_reflected")!;
      e.audience = [Number(e.payload.actorId)];
    },
  ],
  [
    "wrong reflection target",
    (r) => {
      r.events.find((e) => e.type === "time_consort_reflected")!.payload.effectiveId = 999;
    },
  ],
  [
    "wrong reflection kind",
    (r) => {
      r.events.find((e) => e.type === "time_consort_reflected")!.payload.kind = "heal";
    },
  ],
  [
    "forged inspection",
    (r) => {
      const p = r.events.find((e) => e.type === "seer_checked")!.payload;
      p.isWerewolf = true;
      p.result = { kind: "camp", camp: "wolf" };
    },
  ],
];
for (const [label, mutate] of mutations)
  test(
    "Consort Tape rejects " + label,
    async () => {
      const r = structuredClone(await recording("en", "whole_night"));
      mutate(r);
      expect(() => parseReproductionRecord(r)).toThrow();
    },
    120000,
  );

for (const [label, role, change] of [
  [
    "witch poison restored",
    "witch",
    (a: Record<string, unknown>) => {
      (a.state as Record<string, unknown>).poison = 1;
    },
  ],
  [
    "witch uses reset",
    "witch",
    (a: Record<string, unknown>) => {
      a.uses = 0;
    },
  ],
  [
    "witch last-use reset",
    "witch",
    (a: Record<string, unknown>) => {
      a.lastUsedDay = null;
    },
  ],
  [
    "guard original target forged",
    "guard",
    (a: Record<string, unknown>) => {
      (a.state as Record<string, unknown>).lastTarget = 999;
    },
  ],
  [
    "seer history erased",
    "seer",
    (a: Record<string, unknown>) => {
      const s = a.state as Record<string, unknown>;
      s.history = [];
      s.lastTarget = null;
      s.lastIsWerewolf = null;
      s.lastResult = null;
      a.uses = 0;
      a.lastUsedDay = null;
    },
  ],
  [
    "native source forged",
    "guard",
    (a: Record<string, unknown>) => {
      a.source = { kind: "copy", actorId: 1, abilityId: "other" };
    },
  ],
] as const)
  test(
    "Consort Tape rejects resource checkpoint " + label,
    async () => {
      const r = structuredClone(await recording("en", "whole_night"));
      const p = r.checkpoints.at(-1)!.players.find((p) => p.role === role)!;
      const a = Object.values(
        p.privateState.abilities as Record<string, Record<string, unknown>>,
      )[0]!;
      change(a);
      expect(() => parseReproductionRecord(r)).toThrow("reproduction_time_consort_invalid");
    },
    120000,
  );

for (const locale of ["en", "zh-CN"] as const) {
  for (const variant of [
    "reflected poison victim replaced",
    "duplicate death",
    "missing death",
  ] as const) {
    test(
      "Consort death audit rejects " + variant + "/" + locale,
      async () => {
        const record = structuredClone(await recording(locale, "whole_night"));
        const resolved = record.events.find((e) => e.type === "night_resolved")!;
        const reflected = record.events.find(
          (e) => e.type === "time_consort_reflected" && e.payload.kind === "poison",
        )!;
        const actual = Number(reflected.payload.effectiveId);
        const raw = Number(reflected.payload.requestedId);
        const deaths = resolved.payload.deaths as number[];
        expect(actual).not.toBe(raw);
        expect(deaths).toContain(actual);
        const altered =
          variant === "reflected poison victim replaced"
            ? deaths.map((id) => (id === actual ? raw : id))
            : variant === "duplicate death"
              ? [...deaths, actual]
              : deaths.filter((id) => id !== actual);
        resolved.payload.deaths = altered;
        for (const checkpoint of record.checkpoints) {
          const actualPlayer = checkpoint.players.find((p) => p.id === actual)!;
          actualPlayer.alive = !altered.includes(actual);
          if (variant === "reflected poison victim replaced")
            checkpoint.players.find((p) => p.id === raw)!.alive = false;
        }
        for (const decision of record.decisions) {
          for (const event of decision.request.context.visible_events) {
            if (
              event.type === "night_resolved" &&
              JSON.stringify(event.payload.deaths) === JSON.stringify(deaths)
            )
              event.payload.deaths = structuredClone(altered);
          }
        }
        const prefix = structuredClone(record);
        prefix.events = prefix.events.slice(
          0,
          prefix.events.findIndex((e) => e.type === "night_resolved") + 1,
        );
        prefix.decisions = prefix.decisions.filter(
          (d) => d.day === 1 && d.request.phase === "night",
        );
        prefix.checkpoints = [];
        // Check the causal prefix directly, without later deaths or checkpoint comparisons.
        expect(() => validateTimeConsortRecord(prefix)).toThrow(
          "reproduction_time_consort_invalid",
        );
        expect(() => parseReproductionRecord(record)).toThrow();
      },
      120000,
    );
  }
}

for (const locale of ["en", "zh-CN"] as const) {
  for (const mode of ["none", "guard", "heal", "guard_and_heal", "guard_and_poison"] as const) {
    test(
      "Consort causal death matrix/" + locale + "/" + mode,
      async () => {
        const r = structuredClone(await recording(locale, "whole_night"));
        const id = (role: string) => r.metadata.players.find((p) => p.role === role)!.id;
        const victim = id("villager"),
          consort = id("time_wolf_consort"),
          witch = id("witch");
        const guarded =
          mode === "guard" || mode === "guard_and_heal" || mode === "guard_and_poison";
        const potion =
          mode === "heal" || mode === "guard_and_heal"
            ? "heal"
            : mode === "guard_and_poison"
              ? "poison"
              : "none";
        r.events = r.events
          .slice(0, r.events.findIndex((e) => e.type === "night_resolved") + 1)
          .filter((e) => e.type !== "time_consort_reflected");
        r.decisions = r.decisions.filter((d) => d.day === 1 && d.request.phase === "night");
        r.checkpoints = [];
        for (const decision of r.decisions) decision.request.context.visible_events = [];
        for (const d of r.decisions) {
          if (d.outcome.kind !== "action" || !d.outcome.action) continue;
          const action = d.outcome.action;
          if (action.name === "lock_time") {
            action.args.target_id = null;
            action.args.abstain = true;
          }
          if (action.name === "guard") {
            action.args.target_id = guarded ? victim : null;
            action.args.abstain = !guarded;
          }
          if (action.name === "kill_vote") {
            action.args.target_id = victim;
            action.args.abstain = false;
          }
          if (action.name === "use_potion") {
            action.args.target_id = potion === "none" ? witch : victim;
            action.args.potion_type = potion as typeof action.args.potion_type;
          }
          if (action.name === "check_identity") action.args.target_id = consort;
        }
        for (const e of r.events) {
          if (e.type === "time_consort_lock_committed") e.payload.targetId = null;
          if (e.type === "guard_applied") {
            e.payload.targetId = guarded ? victim : null;
            e.payload.abstain = !guarded;
          }
          if (e.type === "wolf_kill_vote_cast") {
            e.payload.targetId = victim;
            e.payload.abstain = false;
          }
          if (e.type === "witch_potion_used" || e.type === "witch_potion_skipped") {
            e.type = potion === "none" ? "witch_potion_skipped" : "witch_potion_used";
            e.payload = {
              actorId: witch,
              targetId: potion === "none" ? witch : victim,
              ...(potion === "none" ? {} : { potionType: potion }),
            };
          }
          if (e.type === "seer_checked") {
            e.payload.targetId = consort;
            e.payload.isWerewolf = true;
            e.payload.result = { kind: "camp", camp: "wolf" };
          }
        }
        const resolved = r.events.find((e) => e.type === "night_resolved")!;
        const dies = mode === "none" || mode === "guard_and_heal" || mode === "guard_and_poison";
        resolved.payload.deaths = dies ? [victim] : [];
        expect(() => validateTimeConsortRecord(r)).not.toThrow();
        resolved.payload.deaths = dies ? [] : [victim];
        expect(() => validateTimeConsortRecord(r)).toThrow("reproduction_time_consort_invalid");
      },
      120000,
    );
  }
}
