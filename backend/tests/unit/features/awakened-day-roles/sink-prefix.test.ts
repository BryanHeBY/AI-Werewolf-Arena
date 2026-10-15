/**
 * 单元测试负责真实PM／库存／标死写者先成功而随后事实sink失败的严格录制前缀。输入独立手写原板计划和八个具体故障点，
 * 输出真实失败、保留的资源／Alive及可经完整parser的Trace；不造pending候选、不伪造真实死亡、不访问模型或认证。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { awakenedKnightScenario } from "../../../support/features/awakened-knight/builders/transport-plan";
import { ReproductionTrace } from "../../../../src/recording/reproduction/trace";
import { captureCheckpoint } from "../../../../src/app/simulation/reproduction-context";
import {
  parseReproductionRecord,
  type ReproductionMetadata,
} from "../../../../src/recording/reproduction/format";
for (const [type, mode] of [
  ["awakened_guard_cycle_started", "none"],
  ["awakened_protection_expired", "none"],
  ["awakened_beauty_replacement_paid", "none"],
  ["awakened_protection_revealed", "body"],
  ["awakened_protection_block_detail", "body"],
  ["awakened_protection_blocked", "body"],
  ["awakened_duel_resolved", "none"],
  ["awakened_beauty_replaced", "none"],
] as const)
  test(`真实首sink失败保库存与mark前缀/${type}`, async () => {
    const metadata = JSON.parse(
      readFileSync(
        new URL(
          "../../../support/features/awakened-day-roles/fixtures/body-shield-complete.reproduction.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ).metadata as ReproductionMetadata;
    const plan = awakenedKnightScenario(mode),
      g = bootstrapGame(plan.board.config, { fixedRoles: plan.roles }),
      events = Object.getOwnPropertyDescriptor(g.phaseManager, "events")!.value as GameEvent[];
    const trace = new ReproductionTrace(
      metadata,
      () => {},
      () => events,
    );
    trace.checkpoint(
      captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 0, true, events.length),
      events,
    );
    const push = events.push,
      sentinel = Error(`literal_sink:${type}`);
    Object.defineProperty(events, "push", {
      configurable: true,
      value: function (this: GameEvent[], ...es: GameEvent[]) {
        if (es.some((e) => e.type === type)) throw sentinel;
        return Reflect.apply(push, this, es);
      },
    });
    const seen = new Map<number, number>();
    let failure: unknown;
    try {
      await g.phaseManager.runSingleCycle({
        getAction: (r) =>
          trace.decide(r, {
            async getAction(req) {
              const n = seen.get(req.actorId) ?? 0,
                t = plan.turns.get(req.actorId)?.[n];
              if (!t || t.stage !== req.context.stage) throw Error("literal_plan_mismatch");
              seen.set(req.actorId, n + 1);
              return t.action;
            },
          }),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBe(sentinel);
    trace.noteFailure("cycle", failure);
    trace.checkpoint(
      captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 1, false, events.length, failure),
      events,
    );
    const r = trace.build();
    expect(() => parseReproductionRecord(r)).not.toThrow();
    expect(r.events.some((e) => e.type === type)).toBe(false);
    expect(r.checkpoints.at(-1)!.complete).toBe(false);
    if (type === "awakened_beauty_replacement_paid") {
      const b = r.checkpoints.at(-1)!.players.find((p) => p.id === 10)!;
      expect((b.privateState.awakenedBeauty as any).replacement.targetId).toBe(2);
      expect(b.alive).toBe(true);
      expect(r.checkpoints.at(-1)!.players.find((p) => p.id === 2)!.alive).toBe(true);
    }
    if (type === "awakened_duel_resolved")
      expect(r.checkpoints.at(-1)!.players.find((p) => p.id === 2)!.alive).toBe(false);
  });
