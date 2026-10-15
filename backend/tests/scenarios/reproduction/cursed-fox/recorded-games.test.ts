/**
 * Reproduction scenarios verify Cursed Fox complete recorded games preserve inspection interactions and chain-final individual or faction victory.
 * Input: Original knife, inspection, dream, mirror, lucky and king-chain transport/locale matrices with a literal result table.
 * Output and oracle: Handwritten death/survivor/winner facts and private-view assertions remain causal with the actual replay; no engine run generates expected terminal data.
 */
import { expect, test } from "bun:test";
import { Camp, DeathCause, Phase } from "../../../../src/domain";
import { FOX_CASES, foxScenario } from "../../../support/features/cursed-fox/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { promises as fs } from "node:fs";
const expectations = {
  knife: { night: [], alive: [1, 2, 4, 5, 6], foxWins: true },
  inspection: { night: [1], alive: [2, 4, 5, 6], foxWins: false },
  poison_inspection: { night: [1], alive: [2, 4, 5, 6], foxWins: false },
  dream: { night: [], alive: [1, 2, 4, 5, 6], foxWins: true },
  mirror: { night: [], alive: [1, 2, 4, 5, 6], foxWins: true },
  lucky: { night: [1], alive: [2, 4, 5, 6], foxWins: false },
  fox_lucky: { night: [], alive: [1, 2, 4, 5, 6], foxWins: true },
  king_chain: { night: [], alive: [2, 4, 5, 6], foxWins: false },
};
for (const kind of FOX_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: actual bilingual SDK, ACP/MCP complete games and strict Tape keep Fox effects and chain-final individual winners`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const run = await runTransportGame(foxScenario(kind), transport, locale);
        runs.push(run);
        const oracle = expectations[kind],
          events = run.replay.events;
        expect(
          events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
        ).toEqual([oracle.night]);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          oracle.alive,
        );
        expect(run.result.snapshot.result).toEqual({
          winner: oracle.foxWins ? null : Camp.Good,
          reason: oracle.foxWins
            ? "cursed_fox_survived_faction_elimination"
            : "all_wolves_eliminated",
          outcome: {
            kind: "victory",
            primary: oracle.foxWins
              ? {
                  kind: "individual",
                  goalId: "netease_cursed_fox_last_faction_v1",
                  playerId: 1,
                  winningPlayerIds: [1],
                }
              : { kind: "faction", faction: Camp.Good, winningPlayerIds: [2, 4, 5, 6] },
            additional: [],
            winningPlayerIds: oracle.foxWins ? [1] : [2, 4, 5, 6],
          },
          decidedAt: { day: 1, phase: Phase.Voting, checkpoint: "exile_settled" },
        });
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        expect(
          events
            .filter((e) => e.type === "wolf_king_shot")
            .map((e) => [e.payload.actorId, e.payload.targetId]),
        ).toEqual(kind === "king_chain" ? [[3, 1]] : []);
        if (kind === "king_chain")
          expect(events.findIndex((e) => e.type === "wolf_king_shot")).toBeLessThan(
            events.findIndex((e) => e.type === "game_over"),
          );
        if (kind === "mirror")
          expect(events.find((e) => e.type === "role_inspected")?.payload.result).toEqual({
            kind: "role",
            role: "cursed_fox",
          });
        const checks = events.filter((e) => e.type === "seer_checked");
        if (kind !== "mirror")
          expect(checks[0]?.payload.result).toEqual({
            kind: "camp",
            camp: kind === "fox_lucky" ? Camp.Wolf : Camp.Good,
          });
        for (const view of run.views) {
          const visible = view.timeline.filter((e) => e.kind === "event");
          expect(JSON.stringify(visible)).not.toContain("fox_inspection");
          expect(
            visible.filter((e) => e.kind === "event" && e.event.type === "seer_checked"),
          ).toHaveLength(
            kind === "mirror"
              ? 0
              : view.player_id === (kind === "lucky" ? 6 : kind === "fox_lucky" ? 1 : 2)
                ? 1
                : 0,
          );
        }
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((r) => r.trace.rejected === 0)).toBe(true);
        if (transport === "llm" && ["dream", "king_chain", "inspection"].includes(kind))
          await fs.writeFile(
            `/tmp/awa-p8-fox-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _t, ...e }) => e);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
