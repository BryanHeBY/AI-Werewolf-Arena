/**
 * Failure scenarios verify required Mist/Raven responses retain precise paid prefixes without fallback or random knife substitution.
 * Input: Original day/stage/actor boundary table and missing/late/invalid transport/locale matrices.
 * Output and oracle: Explicit failed decision, incomplete checkpoint and committed-state assertions preserve the actual prefix; source action and failure plans stay unchanged.
 */
import { expect, test } from "bun:test";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import type { PlannedTurn } from "../../../support/foundation_transport_plan";
import type { ActionStage } from "../../../../src/core";
import { mistTransportScenario } from "../../../support/mist_raven_transport_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";

const boundaries = [
  { day: 1, stage: "alchemist_mist", actor: "alchemist", rank: 50 },
  { day: 1, stage: "alchemist_snake", actor: "alchemist", rank: 900 },
  { day: 2, stage: "alchemist_snake", actor: "alchemist", rank: 900 },
  { day: 2, stage: "raven_knife", actor: "raven", rank: 450 },
  { day: 2, stage: "wolf_discussion", actor: "raven", rank: 200 },
  { day: 2, stage: "wolf_vote", actor: "raven", rank: 400 },
  { day: 2, stage: "seer", actor: "seer", rank: 500 },
] as const;
const ranks: Partial<Record<ActionStage, number>> = {
  alchemist_mist: 50,
  dreamer: 100,
  wolf_discussion: 200,
  wolf_vote: 400,
  raven_knife: 450,
  seer: 500,
  on_pre_election: 600,
  sheriff_nomination: 650,
  on_daybreak: 700,
  day_speech: 800,
  on_per_speech_gap: 800,
  alchemist_snake: 900,
};
const rank = (t: PlannedTurn) => ranks[t.stage] ?? 1000;
for (const boundary of boundaries)
  for (const failure of ["missing", "late", "invalid"] as const) {
    if (
      failure === "invalid" &&
      !["alchemist_mist", "alchemist_snake", "raven_knife"].includes(boundary.stage)
    )
      continue;
    for (const transport of ["llm", "acp"] as const)
      test(`Mist precise required failure ${boundary.day}/${boundary.stage}/${failure}/${transport}`, async () => {
        for (const locale of ["en", "zh-CN"] as const) {
          const scenario = await mistTransportScenario(),
            actorId = scenario[boundary.actor];
          const turns = new Map<number, PlannedTurn[]>();
          const invalid =
            boundary.stage === "alchemist_mist"
              ? { name: "cast_mist" as const, args: { target_ids: [999, 998, 997] } }
              : boundary.stage === "alchemist_snake"
                ? { name: "use_snake" as const, args: { target_id: 999 } }
                : { name: "raven_knife" as const, args: { target_id: 999 } };
          const error =
            boundary.stage === "alchemist_mist"
              ? RuleError.MistTarget
              : boundary.stage === "alchemist_snake"
                ? RuleError.SnakeTarget
                : RuleError.RavenKnifeTarget;
          for (const [actor, plan] of scenario.turns)
            turns.set(
              actor,
              plan
                .filter(
                  (t) =>
                    t.day < boundary.day || (t.day === boundary.day && rank(t) <= boundary.rank),
                )
                .map((t) =>
                  actor === actorId && t.day === boundary.day && t.stage === boundary.stage
                    ? {
                        ...t,
                        terminalFailure: failure === "late" ? "late" : "missing",
                        action: failure === "late" ? t.action : null,
                        ...(failure === "invalid"
                          ? { invalidActions: [invalid], expectedInvalidError: error }
                          : {}),
                      }
                    : {
                        ...t,
                        ...(actor === actorId && t.day < boundary.day && t.stage === boundary.stage
                          ? { responseDelayMs: 1300 }
                          : {}),
                      },
                ),
            );
          const run = await runTransportGame(
            { ...scenario, turns, expectedFailure: { actorId, stage: boundary.stage } },
            transport,
            locale,
          );
          const cp = run.record.checkpoints.at(-1)!;
          expect(cp.complete).toBe(false);
          expect(cp.cycle).toBe(boundary.day);
          expect(run.record.termination?.reason).toBe("runtime_error");
          expect(cp.snapshot.gameOver).toBe(false);
          expect(run.replay.events.some((e) => e.type === "game_over")).toBe(false);
          expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(
            boundary.day - 1,
          );
          const caster = cp.players.find((p) => p.id === scenario.alchemist)!.privateState
            .alchemist;
          const raven = cp.players.find((p) => p.id === scenario.raven)!.privateState.ravenClaw;
          if (boundary.stage === "alchemist_mist")
            expect(caster).toMatchObject({
              mistRemaining: 1,
              mistHistory: [],
              healRemaining: 1,
              healHistory: [],
            });
          else
            expect(caster).toMatchObject({
              mistRemaining: 0,
              mistHistory: [{ day: 1, targetIds: [2, 3, 8] }],
              healRemaining: 1,
              healHistory: boundary.day === 1 ? [] : [{ day: 1, targetId: null }],
            });
          if (boundary.day === 2 && boundary.rank <= 450)
            expect(raven).toMatchObject({ extraRemaining: 1, extraHistory: [] });
          if (failure === "invalid")
            expect(
              transport === "llm"
                ? run.rejected.get(actorId)
                : run.acpTraces.find((t) => t.actor === actorId)!.trace.rejected,
            ).toBeGreaterThanOrEqual(1);
          expect(run.diagnostics.pendingDelays).toBe(0);
          if (boundary.stage === "alchemist_snake" && boundary.day === 2) {
            const prior = run.record.decisions.find(
              (d) => d.actorId === actorId && d.day === 1 && d.stage === boundary.stage,
            )!;
            expect(prior.outcome).toEqual({
              kind: "action",
              action: { name: "use_snake", args: { target_id: null } },
            });
            if (transport === "llm")
              expect(
                run.diagnostics.delayedResponses.some((d) => d.actorId === actorId && d.completed),
              ).toBe(true);
          }
        }
      }, 120000);
  }

for (const failure of ["missing", "late"] as const)
  for (const transport of ["llm", "acp"] as const)
    test(`Mist active circle never turns transport failure into random knife/${failure}/${transport}`, async () => {
      for (const locale of ["en", "zh-CN"] as const) {
        const scenario = await mistTransportScenario("draw"),
          actorId = 5;
        const turns = new Map<number, PlannedTurn[]>();
        for (const [actor, plan] of scenario.turns)
          turns.set(
            actor,
            plan
              .filter((t) => t.day === 1 && rank(t) <= 400)
              .map((t) =>
                actor === actorId && t.stage === "wolf_vote"
                  ? {
                      ...t,
                      terminalFailure: failure,
                      action: failure === "missing" ? null : t.action,
                      ...(failure === "missing" ? { responseDelayMs: 1300 } : {}),
                    }
                  : t,
              ),
          );
        const run = await runTransportGame(
          { ...scenario, turns, expectedFailure: { actorId, stage: "wolf_vote" } },
          transport,
          locale,
        );
        expect(
          run.record.checkpoints.at(-1)!.players.find((p) => p.id === scenario.alchemist)!
            .privateState.alchemist,
        ).toMatchObject({
          mistRemaining: 0,
          healRemaining: 1,
          mistHistory: [{ day: 1, targetIds: [5, 11, 8] }],
          healHistory: [],
        });
        for (const other of [8, 11]) {
          expect(
            run.record.decisions.find((d) => d.actorId === other && d.stage === "wolf_vote")
              ?.outcome,
          ).toEqual({
            kind: "action",
            action: { name: "kill_vote", args: { target_id: null, abstain: true } },
          });
        }
        expect(
          run.replay.events.some((e) =>
            ["mist_knife_drawn", "night_resolved", "alchemist_snake_chosen", "game_over"].includes(
              e.type,
            ),
          ),
        ).toBe(false);
        expect(run.record.termination?.reason).toBe("runtime_error");
      }
    }, 120000);
