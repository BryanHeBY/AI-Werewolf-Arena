/**
 * Reproduction scenarios verify Pure White and Wolf Witch complete recorded games preserve private inspections and chain-final settlement.
 * Input: Original good/wolf scenario, transport and locale matrices with declared dead/alive/winner facts.
 * Output and oracle: Explicit private-result counts, winning members and final checkpoint assertions retain exact replay; original diagnostic temporary file names and contents are unchanged.
 */
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { Camp, Phase } from "../../../../src/domain";
import { pureWhiteScenario } from "../../../support/features/pure-white-girl/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const kind of ["wolf", "good"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`pure-white ${kind}/${transport}: bilingual real SDK and ACP preserve private inspection and strict Tape`, async () => {
      const scenario = pureWhiteScenario(kind);
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const events = run.replay.events;
        expect(events.filter((e) => e.type === "role_inspected")).toHaveLength(4);
        const deaths = events.filter((e) => e.type === "night_resolved").at(-1)!.payload.deaths;
        expect(deaths).toEqual(expect.arrayContaining(scenario.dead));
        expect(deaths).toHaveLength(scenario.dead.length);
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.result.snapshot.result?.decidedAt).toEqual({
          day: 2,
          phase: Phase.Night,
          checkpoint: "night_settled",
        });
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        const winners =
          scenario.winner === Camp.Wolf
            ? scenario.wolves
            : scenario.roles.flatMap((_, i) => (!scenario.wolves.includes(i + 1) ? [i + 1] : []));
        if (run.result.snapshot.result?.outcome.kind !== "victory")
          throw new Error("expected_victory");
        expect(run.result.snapshot.result.outcome.winningPlayerIds).toEqual(winners);
        for (const view of run.views) {
          const reports = view.timeline.filter(
            (row) => row.kind === "event" && row.event.type === "role_inspected",
          );
          expect(reports).toHaveLength(
            [scenario.pure, scenario.wolfWitch].includes(view.player_id) ? 2 : 0,
          );
        }
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (transport === "llm") {
          await writeFile(
            `/tmp/awa-p9-pure-white-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
          await writeFile(
            `/tmp/awa-p9-pure-white-${kind}-${locale}.checkpoint.json`,
            JSON.stringify(run.record.checkpoints.at(-1)),
          );
          await writeFile(
            `/tmp/awa-p9-pure-white-${kind}-${locale}.views.json`,
            JSON.stringify(run.views),
          );
        }
      }
      expect(runs[0].result).toEqual(runs[1].result);
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
