import { expect, spyOn, test } from "bun:test";
import {
  COMPONENT,
  type ActionProvider,
  type ActionStage,
  type World,
  type AliveComponent,
} from "../../src/core";
import { createAliveComponent } from "../../src/core/domain/components/alive";
import { PhaseManager } from "../../src/game/engine/phase_manager";
import type { PlannedTurn } from "../support/foundation_transport_plan";
import { nobleTransportScenario } from "../support/noble_secret_body_transport_scenarios";
import { runTransportGame } from "../support/run_transport_game";
import { assertNobleTransportWire } from "../support/noble_secret_body_wire_oracle";

const rank: Partial<Record<ActionStage, number>> = {
  secret_body: 150,
  wolf_discussion: 200,
  wolf_vote: 400,
  night_noble: 450,
};
// Test-only supervisor: the real transport reply has returned but domain commit has not run.
// Lock to the runner's first manager so the subsequent strict Tape replay is untouched.
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
        let manager: PhaseManager | undefined,
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
                    const id =
                        changed === "actor"
                          ? actorId
                          : scenario.mapping.get(stage === "secret_body" ? 7 : 6)!,
                      previous = world.getComponent<AliveComponent>(id, COMPONENT.Alive),
                      replacement = createAliveComponent(true, locale);
                    expect(Number.isSafeInteger(id)).toBe(true);
                    expect(previous).toBeDefined();
                    world.addComponent(id, COMPONENT.Alive, replacement);
                    expect(world.getComponent<AliveComponent>(id, COMPONENT.Alive)).toBe(
                      replacement,
                    );
                    expect(replacement).not.toBe(previous);
                    expect(replacement.alive).toBe(true);
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
              { ...scenario, turns, expectedFailure: { actorId, stage } },
              kind,
              locale,
            ),
            cp = run.record.checkpoints.at(-1)!;
          expect(fired).toBe(1);
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
