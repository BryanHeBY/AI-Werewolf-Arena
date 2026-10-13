/**
 * Failure scenarios verify missing or late required Nightmare fear responses preserve the original partial recorded game.
 * Input: The original controlled transport plan across LLM/ACP, both locales and required-response failure modes.
 * Output and oracle: Literal incomplete checkpoint, failed actor/stage and absent fear/night settlement assertions retain the actual prefix; the recorded input is not regenerated as a golden.
 */
import { expect, test } from "bun:test";
import { nightmareScenario } from "../../../support/features/nightmare-shadow/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";
for (const failure of ["missing", "late"] as const)
  for (const transport of ["llm", "acp"] as const)
    test(`nightmare required fear ${failure}/${transport} preserves partial Tape`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = nightmareScenario(),
          actorId = scenario.nightmare,
          stage = "nightmare_fear";
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
        expect(run.replay.events.filter((e) => e.type === "nightmare_fear_committed")).toHaveLength(
          0,
        );
        expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(0);
      }
    }, 120000);
