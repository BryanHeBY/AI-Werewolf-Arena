/**
 * Failure scenarios verify Red Moon deferred-night missing or late responses retain the original interrupted recorded prefix.
 * Input: Existing Red Moon transport plans and exact day-three actor/stage cutoff across transports and locales.
 * Output and oracle: Explicit failed decision and absent settlement assertions retain paid deferred state; the existing World-derived plan/alive oracle debt remains unchanged and is not independent coverage.
 */
import { expect, test } from "bun:test";
import { redMoonScenario } from "../../../support/features/red-moon-apostle/drivers/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";
for (const stage of ["wolf_vote", "seer"] as const)
  for (const failure of ["missing", "late"] as const)
    for (const transport of ["llm", "acp"] as const)
      test(
        "Red Moon deferred-night failure " + stage + "/" + failure + "/" + transport,
        async () => {
          for (const locale of ["zh-CN", "en"] as const) {
            const scenario = await redMoonScenario("expire");
            const stop = scenario.ordered.findIndex(
              (row) => row.turn.day === 3 && row.turn.stage === stage,
            );
            expect(stop).toBeGreaterThan(-1);
            const actorId = scenario.ordered[stop]!.actorId;
            const turns = new Map<number, PlannedTurn[]>(scenario.roles.map((_, i) => [i + 1, []]));
            for (const row of scenario.ordered.slice(0, stop + 1)) {
              const turn = structuredClone(row.turn);
              if (row === scenario.ordered[stop]) {
                turn.terminalFailure = failure;
                if (failure === "missing") turn.action = null;
              }
              turns.get(row.actorId)!.push(turn);
            }
            const run = await runTransportGame(
              { ...scenario, turns, expectedFailure: { actorId, stage } },
              transport,
              locale,
            );
            expect(run.record.checkpoints.at(-1)!.complete).toBe(false);
            expect(run.record.decisions.at(-1)).toMatchObject({
              actorId,
              day: 3,
              stage,
              outcome: { kind: "error" },
            });
            expect(
              run.replay.events.filter((e) => e.type === "red_moon_exile_delayed"),
            ).toHaveLength(1);
            expect(
              run.replay.events.filter((e) => e.type === "red_moon_delay_expired"),
            ).toHaveLength(0);
            expect(run.replay.events.filter((e) => e.type === "game_over")).toHaveLength(0);
            const checkpoint = run.record.checkpoints.at(-1)!;
            expect(
              checkpoint.players.find((p) => p.id === scenario.red)!.privateState.redMoon,
            ).toMatchObject({ exileDay: 2, expirySettled: false });
          }
        },
        180000,
      );
