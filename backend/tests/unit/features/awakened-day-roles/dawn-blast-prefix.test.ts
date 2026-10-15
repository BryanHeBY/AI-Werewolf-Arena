/**
 * 单元测试负责真实黎明同波的两个公开分流边界。输入空夜伤或原夜伤同自爆者、独立字面Provider，输出Night根夜报与Day根自爆回执。
 * 使用真实PM／DR／盾和Trace，不调用生产结算生成预期；元数据仅承接原合成牌池，不声称当前同构建严格重放。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PotionType, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { awakenedKnightBlastScenario } from "../../../support/features/awakened-knight/builders/transport-plan";
import { ReproductionTrace } from "../../../../src/recording/reproduction/trace";
import { captureCheckpoint } from "../../../../src/app/simulation/reproduction-context";
import {
  parseReproductionRecord,
  type ReproductionMetadata,
} from "../../../../src/recording/reproduction/format";
for (const raw of ["empty", "same_actor"] as const)
  for (const protectedBlast of [true, false])
    test(`真实黎明合波分公开/${raw}/shield=${protectedBlast}`, async () => {
      const metadata = JSON.parse(
          readFileSync(
            new URL(
              "../../../support/features/awakened-day-roles/fixtures/body-shield-complete.reproduction.json",
              import.meta.url,
            ),
            "utf8",
          ),
        ).metadata as ReproductionMetadata,
        source = awakenedKnightBlastScenario(protectedBlast),
        plan = { ...source, turns: new Map(source.turns) };
      for (const [actor, turns] of plan.turns) {
        for (const t of turns) {
          if (t.day === 1 && t.stage === "wolf_vote")
            t.action = {
              name: "kill_vote",
              args:
                raw === "empty"
                  ? { target_id: null, abstain: true }
                  : { target_id: 8, abstain: false },
            };
          if (t.day === 1 && t.stage === "witch")
            t.action = {
              name: "use_potion",
              args: { target_id: 3, potion_type: PotionType.None },
            };
        }
        plan.turns.set(
          actor,
          turns.filter((t) => !(t.day === 1 && t.stage === "last_words")),
        );
      }
      const g = bootstrapGame(plan.board.config, { fixedRoles: plan.roles }),
        events = Object.getOwnPropertyDescriptor(g.phaseManager, "events")!.value as GameEvent[],
        trace = new ReproductionTrace(
          metadata,
          () => {},
          () => events,
        ),
        seen = new Map<number, number>();
      trace.checkpoint(
        captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 0, true, events.length),
        events,
      );
      await g.phaseManager.runSingleCycle({
        getAction: (r) =>
          trace.decide(r, {
            async getAction(req) {
              const n = seen.get(req.actorId) ?? 0,
                t = plan.turns.get(req.actorId)?.[n];
              if (!t || t.stage !== req.context.stage) throw Error("literal_dawn_plan_mismatch");
              seen.set(req.actorId, n + 1);
              return t.action;
            },
          }),
      });
      trace.checkpoint(
        captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 1, true, events.length),
        events,
      );
      const r = trace.build();
      expect(() => parseReproductionRecord(r)).not.toThrow();
      expect(r.events.find((e) => e.type === "night_resolved")!.payload.deaths).toEqual([]);
      expect(
        r.events.find((e) => e.type === "awakened_self_destruct_resolved")!.payload.deaths,
      ).toEqual(protectedBlast ? [] : [8]);
      expect(r.checkpoints.at(-1)!.players.find((p) => p.id === 8)!.alive).toBe(protectedBlast);
      if (protectedBlast) {
        const detail = r.events.find((e) => e.type === "awakened_protection_block_detail")!.payload;
        expect(detail.rootPhase).toBe("day");
        expect([...(detail.causes as string[])].sort()).toEqual(
          raw === "empty" ? ["self_destruct"] : ["self_destruct", "wolf_kill"],
        );
      }
    });
test("真实合波先mark后夜报sink失败可保原自爆者死亡，不能扩到无提案玩家", async () => {
  const metadata = JSON.parse(
      readFileSync(
        new URL(
          "../../../support/features/awakened-day-roles/fixtures/body-shield-complete.reproduction.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ).metadata as ReproductionMetadata,
    source = awakenedKnightBlastScenario(false),
    plan = { ...source, turns: new Map(source.turns) };
  for (const [actor, turns] of plan.turns) {
    for (const t of turns) {
      if (t.day === 1 && t.stage === "wolf_vote")
        t.action = { name: "kill_vote", args: { target_id: 8, abstain: false } };
      if (t.day === 1 && t.stage === "witch")
        t.action = { name: "use_potion", args: { target_id: 3, potion_type: PotionType.None } };
    }
    plan.turns.set(
      actor,
      turns.filter((t) => !(t.day === 1 && t.stage === "last_words")),
    );
  }
  const g = bootstrapGame(plan.board.config, { fixedRoles: plan.roles }),
    events = Object.getOwnPropertyDescriptor(g.phaseManager, "events")!.value as GameEvent[],
    trace = new ReproductionTrace(
      metadata,
      () => {},
      () => events,
    ),
    seen = new Map<number, number>();
  trace.checkpoint(
    captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 0, true, events.length),
    events,
  );
  const push = events.push,
    sentinel = Error("literal_dawn_publication_failed");
  Object.defineProperty(events, "push", {
    configurable: true,
    value: function (this: GameEvent[], ...es: GameEvent[]) {
      if (es.some((e) => e.type === "night_resolved")) throw sentinel;
      return Reflect.apply(push, this, es);
    },
  });
  let failure: unknown;
  try {
    await g.phaseManager.runSingleCycle({
      getAction: (r) =>
        trace.decide(r, {
          async getAction(req) {
            const n = seen.get(req.actorId) ?? 0,
              t = plan.turns.get(req.actorId)?.[n];
            if (!t || t.stage !== req.context.stage) throw Error("literal_dawn_plan_mismatch");
            seen.set(req.actorId, n + 1);
            return t.action;
          },
        }),
    });
  } catch (e) {
    failure = e;
  }
  expect(failure).toBe(sentinel);
  trace.noteFailure("cycle", failure);
  trace.checkpoint(
    captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 1, false, events.length, failure),
    events,
  );
  const r = trace.build();
  expect(() => parseReproductionRecord(r)).not.toThrow();
  expect(r.checkpoints.at(-1)!.players.find((p) => p.id === 8)!.alive).toBe(false);
  expect(
    r.events.some(
      (e) => e.type === "night_resolved" || e.type === "awakened_self_destruct_resolved",
    ),
  ).toBe(false);
  const bad = structuredClone(r);
  bad.checkpoints.at(-1)!.players.find((p) => p.id === 4)!.alive = false;
  expect(() => parseReproductionRecord(bad)).toThrow("reproduction_awakened_day_roles_invalid");
});
