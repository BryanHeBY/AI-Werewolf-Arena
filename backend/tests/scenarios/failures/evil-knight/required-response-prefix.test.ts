/**
 * Failure scenarios verify required Evil Knight game responses preserve the original incomplete recorded prefix across six stages.
 * Input: The original missing/late LLM/ACP responses, both locales and deterministic night/death-shot plans.
 * Output and oracle: Literal failed actor/stage, prior-night count and absent fallback assertions remain tied to the real execution; no full passing game is substituted for the failure prefix.
 */
import { expect, test } from "bun:test";
import { Role } from "../../../../src/core";
import { evilKnightScenario } from "../../../support/features/evil-knight/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";

const order = ["wolf_discussion", "guard", "wolf_vote", "witch", "seer", "hunter_shot"] as const;
for (const stage of order)
  for (const failure of ["missing", "late"] as const)
    for (const transport of ["llm", "acp"] as const)
      test(`evil knight ${stage}/${failure}/${transport}: required failure preserves partial Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = evilKnightScenario("night_immune_wolf");
          const day = stage === "hunter_shot" ? 2 : 1;
          const actorId =
            stage === "guard"
              ? scenario.roles.indexOf(Role.Guard) + 1
              : stage === "witch"
                ? scenario.witch
                : stage === "seer"
                  ? scenario.seer
                  : stage === "hunter_shot"
                    ? scenario.hunter
                    : scenario.knight;
          const allowed = new Set<string>(order.slice(0, order.indexOf(stage) + 1));
          const turns = new Map<number, PlannedTurn[]>();
          for (const [actor, plan] of scenario.turns) {
            turns.set(
              actor,
              plan
                .filter((t) => t.day < day || (t.day === day && allowed.has(t.stage)))
                .map((t) =>
                  actor === actorId && t.day === day && t.stage === stage
                    ? {
                        ...t,
                        terminalFailure: failure,
                        action: failure === "missing" ? null : t.action,
                      }
                    : t,
                ),
            );
          }
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
          expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(
            day - 1,
          );
          for (const view of run.views)
            for (const row of view.timeline)
              if (row.kind === "turn")
                expect(row.delta_messages.some((m) => m.kind === "fallback")).toBe(false);
        }
      }, 120000);
