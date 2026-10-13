/**
 * Real transport failure scenarios verify Radiant borrowed/native choice failure boundaries.
 * Input: Fixed feature scenarios, precise fail/cancel plans and synthetic SDK/ACP wires.
 * Output and independent oracle: Manual stock/source/prefix assertions, expected refusals and no falsely committed night disclosure.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { assertRadiantTransportWire } from "../../../support/features/radiant-eclipse/oracles/wire";
import { expect, test } from "bun:test";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, PotionType, type ActionStage, type ToolCall } from "../../../../src/core";
import { radiantTransportScenario } from "../../../support/features/radiant-eclipse/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";
const rank: Partial<Record<ActionStage, number>> = {
  eclipse_swallow: 110,
  radiant_shelter: 120,
  dreamer: 150,
  wolf_discussion: 200,
  wolf_vote: 400,
  witch: 500,
  seer: 600,
};
const boundaries = [
  {
    name: "swallow",
    plan: "independent-stock-card16-card17",
    day: 2,
    old: 1,
    stage: "eclipse_swallow",
    invalid: { name: "swallow_skill", args: { target_id: 999 } },
    code: RuleError.EclipseSwallowTarget,
  },
  {
    name: "native shelter",
    plan: "independent-stock-card16-card17",
    day: 2,
    old: 2,
    stage: "radiant_shelter",
    invalid: { name: "cast_shelter", args: { target_id: 999 } },
    code: RuleError.RadiantShelterTarget,
  },
  {
    name: "borrowed shelter",
    plan: "independent-stock-card16-card17",
    day: 3,
    old: 1,
    stage: "radiant_shelter",
    invalid: { name: "cast_shelter", args: { target_id: 999 } },
    code: RuleError.RadiantShelterTarget,
  },
  {
    name: "borrowed dream",
    plan: "borrowed-dream-death-badge-words",
    day: 2,
    old: 1,
    stage: "dreamer",
    invalid: { name: "dream", args: { target_id: 999 } },
    code: RuleError.DreamTarget,
  },
  {
    name: "borrowed potion",
    plan: "independent-stock-card16-card17",
    day: 2,
    old: 1,
    stage: "witch",
    invalid: { name: "use_potion", args: { target_id: 999, potion_type: PotionType.Poison } },
    code: RuleError.PoisonTarget,
  },
  {
    name: "borrowed Seer",
    plan: "independent-stock-card16-card17",
    day: 4,
    old: 1,
    stage: "seer",
    invalid: { name: "check_identity", args: { target_id: 999 } },
    code: RuleError.CheckTarget,
  },
  {
    name: "required wolf chat",
    plan: "independent-stock-card16-card17",
    day: 2,
    old: 12,
    stage: "wolf_discussion",
  },
  {
    name: "required ordinary knife",
    plan: "independent-stock-card16-card17",
    day: 2,
    old: 12,
    stage: "wolf_vote",
  },
  {
    name: "Maid last-wolf knife",
    plan: "independent-stock-card16-card17",
    day: 4,
    old: 1,
    stage: "wolf_vote",
  },
] as const;
for (const b of boundaries)
  for (const mode of ["missing", "late", "invalid"] as const) {
    if (mode === "invalid" && !("invalid" in b)) continue;
    for (const kind of ["llm", "acp"] as const)
      test(`precise Radiant ${b.name}/${mode}/${kind}`, async () => {
        for (const locale of ["en", "zh-CN"] as const) {
          const scenario = await radiantTransportScenario(b.plan),
            actorId = scenario.mapping.get(b.old)!;
          const turns = new Map<number, PlannedTurn[]>();
          for (const [actor, plan] of scenario.turns)
            turns.set(
              actor,
              plan
                .filter(
                  (t) =>
                    t.day < b.day || (t.day === b.day && (rank[t.stage] ?? 1000) <= rank[b.stage]!),
                )
                .map((t) =>
                  actor === actorId && t.day === b.day && t.stage === b.stage
                    ? {
                        ...t,
                        terminalFailure: mode === "late" ? "late" : "missing",
                        action: mode === "late" ? t.action : null,
                        ...(mode === "invalid" && "invalid" in b
                          ? {
                              invalidActions: [b.invalid as ToolCall],
                              expectedInvalidError: b.code,
                            }
                          : {}),
                      }
                    : t,
                ),
            );
          const run = await runTransportGame(
            { ...scenario, turns, expectedFailure: { actorId, stage: b.stage } },
            kind,
            locale,
          );
          assertRadiantTransportWire(run);
          const cp = run.record.checkpoints.at(-1)!;
          expect(cp.complete).toBe(false);
          expect(cp.snapshot.gameOver).toBe(false);
          expect(run.record.termination?.reason).toBe("runtime_error");
          expect(run.record.events.at(-1)).toMatchObject({
            type: "eclipse_lease_closed",
            payload: { day: b.day, status: "aborted" },
            audience: [],
          });
          expect(run.record.events.filter((e) => e.type === "night_resolved")).toHaveLength(
            b.day - 1,
          );
          for (const p of cp.players)
            for (const a of Object.values(
              (p.privateState.abilities ?? {}) as Record<string, any>,
            )) {
              expect(a.nightSuppression).toBeUndefined();
              if (a.id.startsWith("copy:eclipse:")) expect(a.disabled).toBe(true);
            }
          expect(run.diagnostics.pendingDelays).toBe(0);
          if (mode === "invalid")
            expect(
              kind === "llm"
                ? run.rejected.get(actorId)
                : run.acpTraces.find((t) => t.actor === actorId)!.trace.rejected,
            ).toBeGreaterThanOrEqual(1);
        }
      }, 120000);
  }
