/**
 * Failure scenarios verify Order Prince interruption retains only the already-paid choice, speech and revote prefix.
 * Input: Original controlled transport plans, late responses and a copied activation-history forgery.
 * Output and oracle: Literal incomplete checkpoint, activation/history values and absent final exile are followed by explicit rejection; no generic vote expectation replaces the original policy.
 */
import { expect, test } from "bun:test";
import { orderPrinceScenario } from "../../../support/features/order-prince/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
for (const boundary of [
  "order_prince_choice",
  "order_prince_speech",
  "order_prince_revote",
] as const)
  for (const transport of ["llm", "acp"] as const)
    test(
      "Order Prince late " + boundary + "/" + transport + " preserves committed state",
      async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = orderPrinceScenario(),
            actorId = scenario.prince;
          const before = new Set<string>([
            "wolf_discussion",
            "wolf_vote",
            "witch",
            "seer",
            "on_pre_election",
            "sheriff_nomination",
            "last_words",
            "day_speech",
            "on_pre_vote",
            "voting",
            "order_prince_choice",
          ]);
          if (boundary !== "order_prince_choice") before.add("order_prince_speech");
          if (boundary === "order_prince_revote") before.add("order_prince_revote");
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
            run.replay.events.some((e) => e.type === "voted_out" || e.type === "game_over"),
          ).toBe(false);
          const expected = boundary === "order_prince_choice" ? [] : [{ day: 1, activate: true }];
          expect(cp.players.find((p) => p.id === actorId)!.privateState).toEqual({
            orderPrince: { policy: "awa_order_prince_first_ballot_v1", history: expected },
          });
          const tampered = structuredClone(run.record);
          (
            tampered.checkpoints.at(-1)!.players.find((p) => p.id === actorId)!.privateState
              .orderPrince as { history: unknown[] }
          ).history = boundary === "order_prince_choice" ? [{ day: 1, activate: true }] : [];
          expect(() => parseReproductionRecord(tampered)).toThrow(
            "reproduction_order_prince_invalid",
          );
        }
      },
      120000,
    );
