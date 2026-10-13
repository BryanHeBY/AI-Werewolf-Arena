/**
 * Scenario tests for complete evil-knight games over real local transports.
 * Input: original fixed scenario actions, transport and language matrices;
 * output: unchanged terminal, player-view and strict reproduction assertions.
 * Literal winners, alive seats and causal facts are the independent oracle.
 * Synthetic local model/ACP processes exercise the wire; no billed model runs.
 */
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { Camp, Phase } from "../../../../src/core";
import { evilKnightScenario } from "../../../support/features/evil-knight/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const kind of ["night_immune_wolf", "shot_bypass_good", "day_shot_good"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`evil knight ${kind}/${transport}: bilingual real transport, terminal state and strict Tape`, async () => {
      const scenario = evilKnightScenario(kind),
        runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const events = run.replay.events;
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.result.snapshot.result?.decidedAt.day).toBe(2);
        expect(run.result.snapshot.result?.decidedAt.phase).toBe(
          kind === "night_immune_wolf" ? Phase.Night : Phase.Voting,
        );
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
        const last = events.filter((e) => e.type === "night_resolved").at(-1)!.payload.deaths;
        if (!Array.isArray(last) || !last.every((id) => typeof id === "number"))
          throw new Error("invalid_night_deaths");
        expect([...last].sort((a, b) => a - b)).toEqual(
          [...scenario.lastNightDeaths].sort((a, b) => a - b),
        );
        const reportCount = kind === "night_immune_wolf" ? 1 : 2;
        expect(events.filter((e) => e.type === "seer_checked")).toHaveLength(reportCount);
        for (const view of run.views) {
          const reports = view.timeline.filter(
            (row) => row.kind === "event" && row.event.type === "seer_checked",
          );
          expect(reports).toHaveLength(view.player_id === scenario.seer ? reportCount : 0);
          for (const row of view.timeline)
            if (row.kind === "turn")
              expect(row.delta_messages.some((m) => m.kind === "fallback")).toBe(false);
        }
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (transport === "llm") {
          await writeFile(
            `/tmp/awa-p9-evil-knight-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
          await writeFile(
            `/tmp/awa-p9-evil-knight-${kind}-${locale}.checkpoint.json`,
            JSON.stringify(run.record.checkpoints.at(-1)),
          );
          await writeFile(
            `/tmp/awa-p9-evil-knight-${kind}-${locale}.views.json`,
            JSON.stringify(run.views),
          );
        }
      }
      expect(runs[0].result).toEqual(runs[1].result);
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
