/**
 * Failure scenarios verify Time Consort lock and later night failures retain the exact already-paid history and trigger timing.
 * Input: Original missing/late/invalid controlled transport responses and copied guard/reflection-prefix forgery.
 * Output and oracle: Literal incomplete checkpoint, history and trigger values plus explicit forged-prefix rejection preserve causal payment; no production World is run to compute expected alive.
 */
import { expect, test } from "bun:test";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction";
import { type PlannedTurn } from "../../../support/transport/contracts";
import { timeConsortScenario } from "../../../support/features/time-wolf-consort/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const stage of [
  "time_consort_lock",
  "wolf_discussion",
  "guard",
  "wolf_vote",
  "witch",
  "seer",
] as const)
  for (const failure of ["missing", "late", "invalid"] as const) {
    if (failure === "invalid" && stage !== "time_consort_lock") continue;
    for (const transport of ["llm", "acp"] as const)
      test(
        "Consort strict failure prefix/" + stage + "/" + failure + "/" + transport,
        async () => {
          for (const locale of ["zh-CN", "en"] as const) {
            const scenario = timeConsortScenario("whole_night"),
              actorId =
                stage === "time_consort_lock" ||
                stage === "wolf_discussion" ||
                stage === "wolf_vote"
                  ? scenario.consort
                  : stage === "guard"
                    ? scenario.guard
                    : stage === "witch"
                      ? scenario.witch
                      : scenario.seer;
            const ranks: Record<string, number> = {
              time_consort_lock: 50,
              guard: 300,
              wolf_discussion: 200,
              wolf_vote: 400,
              witch: 500,
              seer: 600,
            };
            const turns = new Map<number, PlannedTurn[]>();
            for (const [actor, plan] of scenario.turns)
              turns.set(
                actor,
                plan
                  .filter((t) => t.day === 1 && (ranks[t.stage] ?? 999) <= ranks[stage]!)
                  .map((t) =>
                    actor === actorId && t.stage === stage
                      ? {
                          ...t,
                          terminalFailure:
                            failure === "late" ? ("late" as const) : ("missing" as const),
                          action: failure === "late" ? t.action : null,
                          ...(failure === "invalid"
                            ? {
                                invalidActions: [
                                  {
                                    name: "lock_time" as const,
                                    args: { target_id: 999, abstain: false },
                                  },
                                ],
                                expectedInvalidError: RuleError.TimeConsortTarget,
                              }
                            : {}),
                        }
                      : t,
                  ),
              );
            const run = await runTransportGame(
              { ...scenario, turns, expectedFailure: { actorId, stage } },
              transport,
              locale,
            );
            const cp = run.record.checkpoints.at(-1)!;
            expect(cp.complete).toBe(false);
            expect(run.replay.events.some((e) => e.type === "night_resolved")).toBe(false);
            const state = cp.players.find((p) => p.id === scenario.consort)!.privateState
              .timeConsort as { history: unknown[]; triggeredDay: number | null };
            expect(state.history).toHaveLength(stage === "time_consort_lock" ? 0 : 1);
            expect(state.triggeredDay).toBe(
              stage === "wolf_vote" || stage === "witch" || stage === "seer" ? 1 : null,
            );
            expect(
              run.record.decisions.some(
                (d) => d.actorId === actorId && d.stage === stage && d.outcome.kind === "error",
              ),
            ).toBe(true);
            if (
              stage === "witch" &&
              failure === "missing" &&
              transport === "llm" &&
              locale === "en"
            ) {
              const forged = structuredClone(run.record),
                removed = new Set<number>();
              forged.events.forEach((e, i) => {
                if (e.type === "guard_applied" || e.type === "time_consort_reflected")
                  removed.add(i);
              });
              forged.events = forged.events.filter((_, i) => !removed.has(i));
              for (const checkpoint of forged.checkpoints) {
                const prior = checkpoint.eventCount;
                checkpoint.eventCount -= [...removed].filter((i) => i < prior).length;
                const c = checkpoint.players.find((p) => p.id === scenario.consort)!.privateState
                  .timeConsort as { triggeredDay: number | null };
                c.triggeredDay = null;
                const abilities = checkpoint.players.find((p) => p.id === scenario.guard)!
                  .privateState.abilities as Record<string, Record<string, unknown>>;
                const a = abilities["native:guard"]!;
                a.uses = 0;
                a.lastUsedDay = null;
                (a.state as Record<string, unknown>).lastTarget = null;
              }
              for (const d of forged.decisions)
                d.request.context.visible_events = d.request.context.visible_events.filter(
                  (e) => e.type !== "guard_applied" && e.type !== "time_consort_reflected",
                );
              expect(() => parseReproductionRecord(forged as ReproductionRecord)).toThrow();
            }
          }
        },
        120000,
      );
  }
