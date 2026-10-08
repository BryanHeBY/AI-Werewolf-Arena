import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { HYBRID_CASES, hybridScenario, type HybridScenario } from "../support/hybrid_scenarios";
import { runTransportGame } from "../support/run_transport_game";

/** Independent literal end states; never derived from observed engine winners or chosen camp. */
const facts: Record<HybridScenario, { alive: number[]; words: number[]; target: number; faction: "good" | "wolf"; winner: "good" | "wolf"; winners: number[] }> = {
  good_alive: { alive: [3, 5], words: [1, 2], target: 4, faction: "good", winner: "good", winners: [3, 4, 5, 6] },
  wolf_alive: { alive: [3, 5], words: [1, 2], target: 1, faction: "wolf", winner: "good", winners: [4, 5, 6] },
  good_dead: { alive: [5], words: [3, 1, 2], target: 4, faction: "good", winner: "good", winners: [3, 4, 5, 6] },
  wolf_dead: { alive: [5], words: [3, 1, 2], target: 2, faction: "wolf", winner: "good", winners: [4, 5, 6] },
  wolf_win: { alive: [1, 2], words: [3, 4, 5], target: 1, faction: "wolf", winner: "wolf", winners: [1, 2, 3] },
  hidden: { alive: [3, 4, 5], words: [1, 2], target: 2, faction: "wolf", winner: "good", winners: [4, 5, 6] },
  twelve_good: { alive: [5, 6, 7, 10, 11, 12], words: [4, 1], target: 9, faction: "good", winner: "good", winners: [5, 6, 7, 8, 9, 10, 11, 12] },
  twelve_wolf: { alive: [5, 6, 7, 10, 11, 12], words: [4, 1], target: 1, faction: "wolf", winner: "good", winners: [5, 6, 7, 9, 10, 11, 12] },
  twelve_wolf_win: { alive: [1, 2, 3, 4, 5, 6, 7, 9], words: [8, 12, 10], target: 1, faction: "wolf", winner: "wolf", winners: [1, 2, 3, 4, 8] },
};

for (const kind of HYBRID_CASES) for (const transport of ["llm", "acp", "mixed"] as const) test(`${kind}/${transport}: bilingual real Hybrid selection separates identity, secret affiliation and exact terminal members`, async () => {
  const runs = [];
  for (const locale of ["zh-CN", "en"] as const) {
    const run = await runTransportGame(hybridScenario(kind), transport, locale); runs.push(run);
    const oracle = facts[kind], hybrid = kind.startsWith("twelve") ? 8 : 3, events = run.replay.events;
    expect(run.manifest.players.filter(p => p.alive).map(p => p.player_id)).toEqual(oracle.alive); expect(events.filter(e => e.type === "last_words_spoken").map(e => e.payload.playerId)).toEqual(oracle.words);
    expect(events.filter(e => e.type === "hybrid_exemplar_chosen").map(e => e.payload)).toEqual([{ actorId: hybrid, day: 1, targetId: oracle.target }]);
    expect(events.filter(e => e.type === "hybrid_affiliation_resolved").map(e => e.payload)).toEqual([{ actorId: hybrid, day: 1, targetId: oracle.target, faction: oracle.faction }]);
    const own = run.record.checkpoints.at(-1)!.players.find(p => p.id === hybrid)!;
    expect(own).toMatchObject({ role: "hybrid", camp: "good", privateState: { hybrid: { remaining: 0, choice: { day: 1, targetId: oracle.target } } }, victory: { affiliations: [{ kind: "faction", faction: oracle.faction }] } });
    expect(Object.keys(own.privateState.hybrid as object).sort()).toEqual(["choice", "remaining"]);
    expect(events.filter(e => e.type === "seer_checked" && e.payload.targetId === hybrid).map(e => e.payload.result)).toEqual([{ kind: "camp", camp: "good" }]);
    const reason = oracle.winner === "good" ? "all_wolves_eliminated" : kind === "wolf_win" ? "all_good_eliminated" : "slaughter_side_completed";
    expect(run.result.snapshot.result).toEqual({ winner: oracle.winner, reason, outcome: { kind: "victory", primary: { kind: "faction", faction: oracle.winner, winningPlayerIds: oracle.winners }, additional: [], winningPlayerIds: oracle.winners }, decidedAt: { day: 2, phase: "voting", checkpoint: "exile_settled" } });
    for (const view of run.views) {
      const projected = view.timeline.filter(row => row.kind === "event").map(row => row.event);
      expect(projected.some(e => e.type === "hybrid_affiliation_resolved")).toBe(false);
      expect(projected.filter(e => e.type === "hybrid_exemplar_chosen")).toHaveLength(view.player_id === hybrid ? 1 : 0);
      for (const e of projected.filter(e => e.type === "hybrid_exemplar_chosen")) expect(e.payload).toEqual({ actorId: hybrid, day: 1, targetId: oracle.target });
    }
    expect([...run.rejected.values()].reduce((a, b) => a + b, 0) + run.acpTraces.reduce((a, row) => a + row.trace.rejected, 0)).toBe(kind === "good_alive" ? 1 : 0);
    if (kind.startsWith("twelve") && kind !== "twelve_wolf_win") expect(events.filter(e => e.type === "sheriff_badge_transferred").map(e => e.payload)).toEqual([{ fromId: 8, toId: 5, reason: "voting_death" }]);
    expect(events.filter(e => e.type === "game_over")).toHaveLength(1); expect(events.at(-1)!.type).toBe("game_over");
    if (["wolf_win", "good_dead", "twelve_wolf_win"].includes(kind) && transport === "llm") await writeFile(`/tmp/awa-p7-hybrid-${kind}-${locale}.replay.json`, JSON.stringify(run.replay));
  }
  const neutral = (events: typeof runs[0]["replay"]["events"]) => events.map(({ timestamp: _time, ...event }) => event);
  expect(runs[0].result).toEqual(runs[1].result); expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events)); expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
}, 120000);
