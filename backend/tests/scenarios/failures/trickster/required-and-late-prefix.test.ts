/**
 * Failure scenarios verify Trickster required-choice and later Witch or Prince failures preserve the committed multi-mechanism prefix.
 * Input: Original first/second-night response matrices, controlled transport plans and copied exchange-history forgery.
 * Output and oracle: Explicit exchange/night counts and Magician/Trickster/Prince history assertions retain paid state before deterministic rejection; no role settlement algorithm is used as the expected oracle.
 */
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { expect, test } from "bun:test";
import { tricksterScenario } from "../../../support/features/trickster/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
import { Role } from "../../../../src/core";
for (const night of [1, 2])
  for (const failure of ["missing", "late", "invalid"] as const)
    for (const transport of ["llm", "acp"] as const)
      test(
        "Trickster required choice prefix/" + night + "/" + failure + "/" + transport,
        async () => {
          for (const locale of ["zh-CN", "en"] as const) {
            const scenario = tricksterScenario(),
              actorId = scenario.trickster,
              stage = "trickster_exchange";
            const turns = new Map<number, PlannedTurn[]>();
            for (const [actor, plan] of scenario.turns)
              turns.set(
                actor,
                plan
                  .filter(
                    (t) =>
                      t.day < night ||
                      (t.day === night && ["magician_exchange", stage].includes(t.stage)),
                  )
                  .map((t) =>
                    actor === actorId && t.day === night && t.stage === stage
                      ? {
                          ...t,
                          terminalFailure:
                            failure === "late" ? ("late" as const) : ("missing" as const),
                          action: failure === "late" ? t.action : null,
                          ...(failure === "invalid"
                            ? {
                                invalidActions: [
                                  {
                                    name: "swap_exile_targets" as const,
                                    args: { first_id: actorId, second_id: actorId, abstain: false },
                                  },
                                ],
                                expectedInvalidError: RuleError.TricksterTarget,
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
            expect(
              run.record.decisions.some(
                (d) =>
                  d.actorId === actorId &&
                  d.day === night &&
                  d.stage === stage &&
                  d.outcome.kind === "error",
              ),
            ).toBe(true);
            expect(
              run.replay.events.filter((e) => e.type === "trickster_exchange_committed"),
            ).toHaveLength(night - 1);
            expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(
              night - 1,
            );
            expect(
              (
                cp.players.find((p) => p.id === actorId)!.privateState.trickster as {
                  history: unknown[];
                }
              ).history,
            ).toHaveLength(night - 1);
            expect(run.replay.events.some((e) => e.type === "game_over")).toBe(false);
          }
        },
        120000,
      );
for (const boundary of ["witch", "order_prince_speech", "order_prince_revote"] as const)
  for (const transport of ["llm", "acp"] as const)
    test(
      "Trickster committed prefix survives late " + boundary + "/" + transport,
      async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = tricksterScenario("cancel"),
            actorId =
              boundary === "witch" ? scenario.roles.indexOf(Role.Witch) + 1 : scenario.prince;
          const before = new Set<string>([
            "magician_exchange",
            "trickster_exchange",
            "wolf_discussion",
            "wolf_vote",
            "witch",
          ]);
          if (boundary !== "witch")
            for (const s of [
              "seer",
              "on_pre_election",
              "sheriff_nomination",
              "last_words",
              "day_speech",
              "on_pre_vote",
              "voting",
              "order_prince_choice",
              "order_prince_speech",
            ])
              before.add(s);
          if (boundary === "order_prince_revote") before.add(boundary);
          const turns = new Map<number, PlannedTurn[]>();
          for (const [actor, plan] of scenario.turns)
            turns.set(
              actor,
              plan
                .filter((t) => t.day === 1 && before.has(t.stage))
                .map((t) =>
                  actor === actorId && t.stage === boundary
                    ? { ...t, terminalFailure: "late" as const }
                    : t,
                ),
            );
          const run = await runTransportGame(
            { ...scenario, turns, expectedFailure: { actorId, stage: boundary } },
            transport,
            locale,
          );
          const cp = run.record.checkpoints.at(-1)!;
          expect(cp.complete).toBe(false);
          expect(
            run.record.decisions.some(
              (d) => d.actorId === actorId && d.stage === boundary && d.outcome.kind === "error",
            ),
          ).toBe(true);
          expect(
            run.replay.events.filter((e) => e.type === "trickster_exchange_committed"),
          ).toHaveLength(1);
          const mageId = scenario.roles.indexOf(Role.Magician) + 1;
          const mageState = cp.players.find((p) => p.id === mageId)!.privateState.magician as {
            history: Array<{ day: number; pair: number[] | null }>;
          };
          expect(mageState.history).toHaveLength(1);
          expect(mageState.history[0]!.pair).not.toBeNull();
          if (boundary !== "witch") {
            expect(
              cp.players.find((p) => p.id === scenario.prince)!.privateState.orderPrince,
            ).toEqual({
              policy: "awa_order_prince_first_ballot_v1",
              history: [{ day: 1, activate: true }],
            });
          }
          const state = cp.players.find((p) => p.id === scenario.trickster)!.privateState
            .trickster as { history: Array<{ day: number; pair: number[] | null }> };
          expect(mageState.history).toEqual(state.history);
          expect(state.history).toHaveLength(1);
          expect(state.history[0]!.pair).not.toBeNull();
          expect(
            run.replay.events.some(
              (e) => e.type === "exile_target_mapped" || e.type === "game_over",
            ),
          ).toBe(false);
          expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(
            boundary === "witch" ? 0 : 1,
          );
          const tampered = structuredClone(run.record);
          (
            tampered.checkpoints.at(-1)!.players.find((p) => p.id === scenario.trickster)!
              .privateState.trickster as { history: unknown[] }
          ).history = [];
          expect(() => parseReproductionRecord(tampered)).toThrow("reproduction_trickster_invalid");
        }
      },
      120000,
    );
