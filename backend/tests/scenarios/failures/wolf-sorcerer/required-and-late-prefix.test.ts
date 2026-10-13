/**
 * Failure scenarios verify Wolf Sorcerer required-choice and later-stage failures preserve only the original committed learning prefix.
 * Input: Original night/failure/transport/locale matrices, controlled plans and copied archived learning-state forgeries.
 * Output and oracle: Explicit paid-history, unresolved decision and malformed-prefix rejection remain causal with real recordings; no role action or expected record is regenerated.
 */
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { expect, test } from "bun:test";
import { wolfSorcererScenario } from "../../../support/features/wolf-sorcerer/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
import { Role } from "../../../../src/core";
for (const night of [2, 3])
  for (const failure of ["missing", "late", "invalid"] as const)
    for (const transport of ["llm", "acp"] as const)
      test(
        "Wolf Sorcerer required choice prefix/" + night + "/" + failure + "/" + transport,
        async () => {
          for (const locale of ["zh-CN", "en"] as const) {
            const scenario = (() => {
                const value = wolfSorcererScenario("cancel");
                return { ...value, turns: new Map(value.turns) };
              })(),
              actorId = scenario.sorcerer,
              stage = "wolf_sorcerer_exchange";
            if (night === 3) {
              const victim = scenario.alive.find((id) => scenario.roles[id - 1] === Role.Villager)!;
              for (const [id, plan] of scenario.turns)
                scenario.turns.set(
                  id,
                  plan
                    .filter((t) => !(t.day === 2 && t.stage === "last_words"))
                    .map((t) =>
                      t.day === 2 && t.stage === "voting"
                        ? {
                            ...t,
                            action: {
                              name: "vote",
                              args: {
                                target_id: id === victim ? null : victim,
                                abstain: id === victim,
                              },
                            },
                          }
                        : t,
                    ),
                );
              scenario.turns.get(victim)!.push({
                day: 2,
                stage: "last_words",
                action: { name: "speak", args: { text: "Words" } },
              });
              const mage = scenario.roles.indexOf(Role.Magician) + 1;
              scenario.turns.get(mage)!.push({
                day: 3,
                stage: "magician_exchange",
                action: {
                  name: "swap_targets",
                  args: { first_id: null, second_id: null, abstain: true },
                },
              });
              const mates = scenario.roles.flatMap((role, i) =>
                role === Role.Wolf ? [i + 1] : [],
              );
              scenario.turns.get(actorId)!.push({
                day: 3,
                stage,
                action: {
                  name: "swap_night_seats",
                  args: { first_id: null, second_id: null, abstain: true },
                },
                currentTeammateIds: mates,
              });
            }
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
                                    name: "swap_night_seats" as const,
                                    args: { first_id: actorId, second_id: actorId, abstain: false },
                                  },
                                ],
                                expectedInvalidError: RuleError.WolfSorcererTarget,
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
              run.replay.events.filter((e) => e.type === "wolf_sorcerer_exchange_committed"),
            ).toHaveLength(night - 2);
            expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(
              night - 1,
            );
            expect(
              (
                cp.players.find((p) => p.id === actorId)!.privateState.wolfSorcerer as {
                  history: unknown[];
                }
              ).history,
            ).toHaveLength(night - 2);
            expect(
              (
                cp.players.find((p) => p.role === Role.Magician)!.privateState.magician as {
                  history: unknown[];
                }
              ).history,
            ).toHaveLength(night - 1);
            expect(run.replay.events.some((e) => e.type === "game_over")).toBe(false);
          }
        },
        120000,
      );
for (const boundary of ["witch", "psychic", "hunter_shot"] as const)
  for (const transport of ["llm", "acp"] as const)
    test(
      "Wolf Sorcerer committed prefix survives late " + boundary + "/" + transport,
      async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = (() => {
              const value = wolfSorcererScenario("cancel");
              return { ...value, turns: new Map(value.turns) };
            })(),
            actorId =
              boundary === "witch"
                ? scenario.roles.indexOf(Role.Witch) + 1
                : boundary === "psychic"
                  ? scenario.psychic
                  : scenario.hunter;
          const before = new Set<string>([
            "magician_exchange",
            "wolf_sorcerer_exchange",
            "wolf_discussion",
            "wolf_vote",
            "witch",
          ]);
          if (boundary !== "witch") before.add("psychic");
          if (boundary === "hunter_shot") before.add(boundary);
          const turns = new Map<number, PlannedTurn[]>();
          for (const [actor, plan] of scenario.turns)
            turns.set(
              actor,
              plan
                .filter((t) => t.day < 2 || (t.day === 2 && before.has(t.stage)))
                .map((t) =>
                  actor === actorId && t.day === 2 && t.stage === boundary
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
              (d) =>
                d.actorId === actorId &&
                d.day === 2 &&
                d.stage === boundary &&
                d.outcome.kind === "error",
            ),
          ).toBe(true);
          expect(
            run.replay.events.filter((e) => e.type === "wolf_sorcerer_exchange_committed"),
          ).toHaveLength(1);
          for (const [role, key] of [
            [Role.WolfSorcerer, "wolfSorcerer"],
            [Role.Magician, "magician"],
          ] as const) {
            const state = cp.players.find((p) => p.role === role)!.privateState[key] as {
              history: Array<{ day: number; pair: number[] | null }>;
            };
            expect(state.history).toHaveLength(1);
            expect(state.history[0]!.pair).not.toBeNull();
            const tampered = structuredClone(run.record);
            (
              tampered.checkpoints.at(-1)!.players.find((p) => p.role === role)!.privateState[
                key
              ] as { history: unknown[] }
            ).history = [];
            expect(() => parseReproductionRecord(tampered)).toThrow();
          }
          expect(run.replay.events.some((e) => e.type === "game_over")).toBe(false);
          expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(
            boundary === "hunter_shot" ? 2 : 1,
          );
        }
      },
      120000,
    );
