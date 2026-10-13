/**
 * Failure scenarios verify Scholar Mentor choice, bonus and later night interruptions preserve the exact second-cycle paid prefix.
 * Input: Original controlled response matrices and copied actor, candidate or paid-guard record forgeries.
 * Output and oracle: Literal failed actor/cycle, remaining stock and history assertions remain together with explicit forgery rejection; the generated record supplies input rather than new golden output.
 */
import { expect, test } from "bun:test";
import { Role } from "../../../../src/core";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction";
import { type PlannedTurn } from "../../../support/transport/contracts";
import { scholarMentorScenario } from "../../../support/features/scholar-mentor/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const target of [
  "choice",
  "wolf_discussion",
  "guard",
  "wolf_vote",
  "bonus-kill",
  "witch",
  "seer",
  "bonus-check",
] as const)
  for (const failure of ["missing", "late"] as const)
    for (const transport of ["llm", "acp"] as const)
      test(
        "Scholar Mentor strict recorded failure/" + target + "/" + failure + "/" + transport,
        async () => {
          for (const locale of ["zh-CN", "en"] as const) {
            const scenario = scholarMentorScenario(),
              stage =
                target === "choice"
                  ? "scholar_mentor_choice"
                  : target.startsWith("bonus")
                    ? "scholar_mentor_bonus"
                    : target;
            const guard = scenario.roles.indexOf(Role.Guard) + 1,
              witch = scenario.roles.indexOf(Role.Witch) + 1;
            const actorId =
              target === "choice"
                ? scenario.scholar
                : target === "guard"
                  ? guard
                  : target === "bonus-kill" ||
                      target === "wolf_vote" ||
                      target === "wolf_discussion"
                    ? scenario.knifeActor
                    : target === "witch"
                      ? witch
                      : scenario.seer;
            const rank = (t: PlannedTurn) =>
              t.stage === "scholar_mentor_bonus" && t.action?.name === "bonus_action"
                ? ({ guard: 350, kill: 450, poison: 550, check: 650 } as const)[t.action.args.kind]
                : ((
                    {
                      scholar_mentor_choice: 50,
                      wolf_discussion: 200,
                      guard: 300,
                      wolf_vote: 400,
                      witch: 500,
                      seer: 600,
                    } as Record<string, number>
                  )[t.stage] ?? 1000);
            const ceiling = (
                {
                  choice: 50,
                  wolf_discussion: 200,
                  wolf_vote: 400,
                  guard: 300,
                  "bonus-kill": 450,
                  witch: 500,
                  seer: 600,
                  "bonus-check": 650,
                } as const
              )[target],
              turns = new Map<number, PlannedTurn[]>();
            for (const [actor, plan] of scenario.turns)
              turns.set(
                actor,
                plan
                  .filter((t) => t.day < 2 || (t.day === 2 && rank(t) <= ceiling))
                  .map((t) =>
                    actor === actorId && t.day === 2 && t.stage === stage
                      ? {
                          ...t,
                          terminalFailure: failure,
                          action: failure === "late" ? t.action : null,
                        }
                      : t,
                  ),
              );
            const run = await runTransportGame(
                { ...scenario, turns, expectedFailure: { actorId, stage } },
                transport,
                locale,
              ),
              cp = run.record.checkpoints.at(-1)!;
            expect(cp.complete).toBe(false);
            expect(cp.cycle).toBe(2);
            expect(run.replay.events.some((e) => e.type === "night_resolved" && e.day === 2)).toBe(
              false,
            );
            expect(
              run.record.decisions.some(
                (d) =>
                  d.actorId === actorId &&
                  d.day === 2 &&
                  d.stage === stage &&
                  d.outcome.kind === "error",
              ),
            ).toBe(true);
            const state = cp.players.find((p) => p.id === scenario.scholar)!.privateState
              .scholarMentor as { history: unknown[]; remaining: { enhance: number } };
            expect(state.history).toHaveLength(target === "choice" ? 0 : 1);
            expect(state.remaining.enhance).toBe(target === "choice" ? 1 : 0);
            const failedDecision = (record: ReproductionRecord) =>
              record.decisions.find(
                (d) =>
                  d.actorId === actorId &&
                  d.day === 2 &&
                  d.stage === stage &&
                  d.outcome.kind === "error",
              )!;
            const impostor = structuredClone(run.record);
            const failed = failedDecision(impostor);
            const villager = cp.players.find((p) => p.alive && p.role === Role.Villager)!;
            failed.actorId = villager.id;
            failed.request.actorId = villager.id;
            failed.request.context.visible_events = [];
            expect(() => parseReproductionRecord(impostor)).toThrow(
              "reproduction_scholar_mentor_invalid",
            );
            if (target === "choice") {
              for (const field of ["modifier_candidates", "modifier_modes"] as const) {
                const forged = structuredClone(run.record);
                if (field === "modifier_candidates")
                  failedDecision(forged).request.context.modifier_candidates = [999];
                else failedDecision(forged).request.context.modifier_modes = [];
                expect(() => parseReproductionRecord(forged)).toThrow(
                  "reproduction_scholar_mentor_invalid",
                );
              }
            }
            if (
              target === "witch" &&
              failure === "missing" &&
              transport === "llm" &&
              locale === "en"
            ) {
              const forged = structuredClone(run.record),
                removed = new Set<number>();
              let day = 1;
              for (let i = 0; i < forged.events.length; i++) {
                const e = forged.events[i]!;
                if (e.type === "phase_changed") day = Number(e.payload.day);
                if (day === 2 && e.type === "guard_applied") removed.add(i);
              }
              expect(removed.size).toBe(1);
              forged.events = forged.events.filter((_, i) => !removed.has(i));
              for (const c of forged.checkpoints) {
                const prior = c.eventCount;
                c.eventCount -= [...removed].filter((i) => i < prior).length;
                if (c.cycle < 2) continue;
                const a = (
                  c.players.find((p) => p.id === guard)!.privateState.abilities as Record<
                    string,
                    {
                      uses: number;
                      lastUsedDay: number | null;
                      state: { lastTarget: number | null };
                    }
                  >
                )["native:guard"]!;
                const earlier = (
                  forged.checkpoints
                    .find((p) => p.cycle === 1)!
                    .players.find((p) => p.id === guard)!.privateState.abilities as Record<
                    string,
                    typeof a
                  >
                )["native:guard"]!;
                a.uses = earlier.uses;
                a.lastUsedDay = earlier.lastUsedDay;
                a.state.lastTarget = earlier.state.lastTarget;
              }
              for (const d of forged.decisions)
                if (d.day === 2)
                  d.request.context.visible_events = d.request.context.visible_events.filter(
                    (e) => e.type !== "guard_applied",
                  );
              expect(() => parseReproductionRecord(forged as ReproductionRecord)).toThrow();
            }
          }
        },
        120000,
      );
