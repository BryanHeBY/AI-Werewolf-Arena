/**
 * 真实传输撤销场景验证原贵族／躯体生命被替换后，未结束请求会取消。输入为实际 turn 开启、
 * 显式归档的单步生命替换与原模型回复；同一故障 owner 在录制／严格重放执行，撤销后无消费／提交选择与原字面部分 checkpoint／wire
 * 结果是独立预期。不调用计费模型，也不重写 fixture 或 Tape 预期字节。
 */
import { expect, spyOn, test } from "bun:test";
import {
  COMPONENT,
  type ActionProvider,
  type ActionStage,
  type World,
  type AliveComponent,
} from "../../../../src/domain";

import { PhaseManager } from "../../../../src/engine/phase-manager";
import { type PlannedTurn } from "../../../support/transport/contracts";
import { nobleTransportScenario } from "../../../support/features/noble-secret-body/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { assertNobleTransportWire } from "../../../support/features/noble-secret-body/oracles/wire";

const rank: Partial<Record<ActionStage, number>> = {
  secret_body: 150,
  wolf_discussion: 200,
  wolf_vote: 400,
  night_noble: 450,
};
// 仅测试使用的监督点：真实传输回复已返回，但领域提交尚未执行。
// 只锁定 runner 的首个管理器观察原引用；不写生命，不在 replay 注入另一份镜像故障。
for (const [stage, old, changed] of [
  ["secret_body", 5, "actor"],
  ["secret_body", 5, "target"],
  ["night_noble", 1, "actor"],
  ["night_noble", 1, "target"],
  ["awakened_idiot_reveal_speech", 5, "actor"],
] as const)
  for (const kind of ["llm", "acp"] as const)
    test(`actual Noble revoked original life ${stage}/${changed}/${kind}`, async () => {
      for (const locale of ["en", "zh-CN"] as const) {
        const reveal = stage === "awakened_idiot_reveal_speech",
          scenario = nobleTransportScenario(reveal ? "badge_reveal" : "expiry"),
          day = reveal ? 1 : 2,
          actorId = scenario.mapping.get(old)!,
          turns = new Map<number, PlannedTurn[]>();
        for (const [actor, plan] of scenario.turns)
          turns.set(
            actor,
            plan
              .filter(
                (t) =>
                  t.day < day ||
                  (t.day === day && (reveal || (rank[t.stage] ?? 1000) <= rank[stage]!)),
              )
              .map((t) =>
                actor === actorId && t.day === day && t.stage === stage
                  ? { ...t, terminalFailure: "revoked" as const }
                  : t,
              ),
          );
        const playerId =
          changed === "actor" ? actorId : scenario.mapping.get(stage === "secret_body" ? 7 : 6)!;
        const faultPlan = {
          version: "awa_noble_request_fault_plan_v1" as const,
          steps: [
            {
              id: "noble_original_life_replaced",
              at: {
                day,
                point: "after_provider_return" as const,
                afterDecision: { actorId, stage, turn: 1 as const },
              },
              mutation: {
                kind: "replace_alive_component" as const,
                playerId,
                alive: true as const,
              },
            },
          ] as [import("../../../../src/domain/fault-plan").NobleRequestFaultStep],
        };
        let manager: PhaseManager | undefined,
          previousLife: AliveComponent | undefined,
          observedWorld: World | undefined,
          fired = 0;
        const original = PhaseManager.prototype.runSingleCycle,
          spy = spyOn(PhaseManager.prototype, "runSingleCycle").mockImplementation(async function (
            this: PhaseManager,
            provider: ActionProvider,
            maxDays?: number,
          ) {
            manager ??= this;
            if (manager !== this) return original.call(this, provider, maxDays);
            const world = (this as unknown as { world: World }).world;
            return original.call(
              this,
              {
                getAction: async (request) => {
                  const action = await provider.getAction(request);
                  if (
                    !fired &&
                    request.actorId === actorId &&
                    request.context.day === day &&
                    request.context.stage === stage
                  ) {
                    expect(action).toEqual(
                      turns.get(actorId)!.find((t) => t.day === day && t.stage === stage)!.action,
                    );
                    previousLife = world.getComponent(playerId, COMPONENT.Alive);
                    observedWorld = world;
                    expect(Number.isSafeInteger(playerId)).toBe(true);
                    expect(previousLife).toBeDefined();
                    fired++;
                  }
                  return action;
                },
              },
              maxDays,
            );
          });
        try {
          const run = await runTransportGame(
              { ...scenario, turns, faultPlan, expectedFailure: { actorId, stage } },
              kind,
              locale,
            ),
            cp = run.record.checkpoints.at(-1)!;
          expect(fired).toBe(1);
          const replacement = observedWorld!.getComponent(playerId, COMPONENT.Alive)!;
          expect(replacement).not.toBe(previousLife);
          expect(replacement.alive).toBe(true);
          expect(run.record.metadata.faultPlan).toEqual(faultPlan);
          expect(
            run.record.operations.filter((op) => op.op === "noble_request_fault_applied"),
          ).toHaveLength(1);
          assertNobleTransportWire(run);
          expect(cp.complete).toBe(false);
          expect(cp.snapshot.gameOver).toBe(false);
          expect(run.record.termination!.reason).toBe("runtime_error");
          expect(run.diagnostics.pendingDelays).toBe(0);
          expect(
            run.record.decisions.filter(
              (d) => d.actorId === actorId && d.day === day && d.stage === stage,
            ),
          ).toHaveLength(1);
          if (reveal) {
            const body = cp.players.find((p) => p.id === actorId)!;
            expect(body.alive).toBe(true);
            expect(body.badge!.isSheriff).toBe(true);
            expect(body.vote).toEqual({ weight: 1.5, canVote: true });
            expect(cp.nobleBody!.body.body).toEqual({ kind: "exile_revealed", day: 1 });
            expect(run.record.events.some((e) => e.type === "secret_body_reveal_speech")).toBe(
              false,
            );
          } else {
            expect(run.record.events.filter((e) => e.type === "night_resolved")).toHaveLength(1);
            expect(cp.nobleBody!.body.body).toEqual({ kind: "intact" });
            expect(
              run.record.events.some(
                (e) => e.type === "noble_body_native_damage_committed" && e.payload.day === day,
              ),
            ).toBe(false);
            const chosen = stage === "secret_body" ? "secret_body_chosen" : "noble_servant_chosen";
            expect(run.record.events.some((e) => e.type === chosen && e.payload.day === day)).toBe(
              false,
            );
          }
        } finally {
          spy.mockRestore();
        }
      }
    }, 120000);
