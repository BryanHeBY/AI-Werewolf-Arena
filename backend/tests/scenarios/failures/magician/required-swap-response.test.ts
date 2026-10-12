/**
 * Failure scenarios verify missing or late required Magician exchange responses preserve the original partial recorded game.
 * Input: Original controlled LLM/ACP transport plans, locale matrix and required-response failures.
 * Output and oracle: Literal failed checkpoint/decision and absent exchange/night settlement assertions span the actual provider-to-recording prefix; no role action is invented as fallback.
 */
import { expect, test } from "bun:test";
import { magicianScenario } from "../../../support/magician_transport_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
import type { PlannedTurn } from "../../../support/foundation_transport_plan";
for (const failure of ["missing", "late"] as const)
  for (const transport of ["llm", "acp"] as const)
    test(`Magician required swap ${failure}/${transport} preserves partial Tape`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = magicianScenario(),
          actorId = scenario.magician,
          stage = "magician_exchange";
        const turns = new Map<number, PlannedTurn[]>();
        for (const [actor, plan] of scenario.turns)
          turns.set(
            actor,
            plan
              .filter((t) => t.day === 1 && t.stage === stage)
              .map((t) => ({
                ...t,
                terminalFailure: failure,
                action: failure === "missing" ? null : t.action,
              })),
          );
        const run = await runTransportGame(
          { ...scenario, turns, expectedFailure: { actorId, stage } },
          transport,
          locale,
        );
        expect(run.record.checkpoints.at(-1)!.complete).toBe(false);
        expect(run.record.decisions.at(-1)).toMatchObject({
          actorId,
          stage,
          outcome: { kind: "error" },
        });
        expect(run.replay.events.some((e) => e.type === "game_over")).toBe(false);
        expect(
          run.replay.events.filter((e) => e.type === "magician_exchange_committed"),
        ).toHaveLength(0);
        expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(0);
      }
    }, 120000);
