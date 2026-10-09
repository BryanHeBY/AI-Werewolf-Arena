import { Camp, DeathCause, Phase } from "../../src/core";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { BLACK_CASES, blackMarketScenario, type BlackScenario } from "../support/black_market_scenarios";
import { runTransportGame } from "../support/run_transport_game";

const facts: Record<BlackScenario, { alive: number[]; words: number[]; day: number; night?: boolean }> = {
  check_cross: { alive: [5, 6], words: [3, 1, 2], day: 2 }, check_duplicate: { alive: [4, 5, 6], words: [1, 2], day: 2 }, poison_duplicate: { alive: [6], words: [3, 1], day: 2, night: true }, late_hold: { alive: [6], words: [1], day: 4, night: true }, hidden_backlash: { alive: [5, 6], words: [3, 1, 2], day: 2 }, seer_gun: { alive: [3, 5, 6], words: [4, 2], day: 1 }, gun_poison: { alive: [5, 6], words: [4, 1, 2], day: 2 }, gun_compound: { alive: [5, 6], words: [4, 1, 2], day: 2 }, native_double: { alive: [3, 5, 6], words: [4], day: 1, night: true }, native_pass: { alive: [3, 5, 6], words: [4, 2], day: 1 }, last_wolf: { alive: [6], words: [3, 2], day: 2, night: true }, last_god: { alive: [6], words: [5, 2], day: 2, night: true }, twelve_gun: { alive: [5, 6, 8, 10, 11, 12], words: [3, 4], day: 2 }, twelve_backlash: { alive: [6, 8, 9, 10, 11, 12], words: [7, 4, 1], day: 2 },
};
for (const kind of BLACK_CASES) for (const transport of ["llm", "acp", "mixed"] as const) test(`${kind}/${transport}: literal Black Market bilingual complete games preserve private gifts and strict Tape`, async () => {
  const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
  for (const locale of ["zh-CN", "en"] as const) {
    const scenario = blackMarketScenario(kind), run = await runTransportGame(scenario, transport, locale); runs.push(run); const events = run.replay.events, oracle = facts[kind];
    expect(run.manifest.players.filter(p => p.alive).map(p => p.player_id)).toEqual(oracle.alive); expect(events.filter(e => e.type === "last_words_spoken").map(e => e.payload.playerId)).toEqual(oracle.words);
    expect(run.result.snapshot.result).toMatchObject({ winner: Camp.Good, reason: "all_wolves_eliminated", decidedAt: { day: oracle.day, phase: oracle.night ? Phase.Day:Phase.Voting, checkpoint: oracle.night ? "night_settled" : "exile_settled" }, outcome: { winningPlayerIds: kind.startsWith("twelve") ? [5, 6, 7, 8, 9, 10, 11, 12] : [3, 4, 5, 6] } });
    const merchant = kind.startsWith("twelve") ? 7 : 3;
    expect(events.filter(e => e.type === "black_market_trade_committed")).toHaveLength(1); expect(events.filter(e => e.type === "black_market_trade_resolved")).toHaveLength(1);
    const choice = events.find(e => e.type === "black_market_trade_committed")!.payload, failed = kind === "hidden_backlash" || kind === "twelve_backlash";
    expect(events.find(e => e.type === "black_market_trade_resolved")!.payload).toEqual({ ...choice, outcome: failed ? "backlash" : "granted" });
    const state = run.record.checkpoints.at(-1)!.players.find(p => p.id === merchant)!.privateState.black_market_merchant;
    expect(state).toEqual({ remaining: 0, closedDay: kind === "late_hold" ? 2 : 1, choice: { day: kind === "late_hold" ? 2 : 1, targetId: choice.targetId, skill: choice.skill } });
    if (kind === "check_cross") expect(events.filter(e => e.type === "seer_checked" && e.day === 2).map(e => [e.payload.actorId, e.payload.targetId, e.payload.result])).toEqual([[6, 2, { kind: "camp", camp: "wolf" }], [4, 2, { kind: "camp", camp: "wolf" }]]);
    if (kind === "check_duplicate") expect(events.filter(e => e.type === "seer_checked").map(e => [e.payload.actorId, e.payload.targetId, e.payload.result])).toEqual([[4, 1, { kind: "camp", camp: "wolf" }], [4, 2, { kind: "camp", camp: "wolf" }], [4, 3, { kind: "camp", camp: "good" }]]);
    if (kind === "check_duplicate") { const abilities = run.record.checkpoints.at(-1)!.players.find(p => p.id === 4)!.privateState.abilities as any; expect(abilities["gift:black-market"].uses).toBe(1); expect(abilities["native:seer_check"].uses).toBe(2); }
    if (kind === "poison_duplicate") { expect(events.filter(e => e.type === "witch_potion_used" && e.day === 2).map(e => [e.payload.actorId, e.payload.targetId, e.payload.potionType])).toEqual([[5, 2, "poison"], [5, 5, "poison"]]); const abilities = run.record.checkpoints.at(-1)!.players.find(p => p.id === 5)!.privateState.abilities as any; expect(abilities["gift:black-market"].state.poison).toBe(0); expect(abilities["native:potion"].state).toMatchObject({ heal: 1, poison: 0 }); }
    if (kind === "late_hold") { expect(events.filter(e => e.type === "witch_potion_used" && e.payload.actorId === 6).map(e => e.day)).toEqual([4]); expect(events.filter(e => e.type === "lucky_ability_skipped" && e.payload.actorId === 6).map(e => e.day)).toEqual([3]); }
    if (kind === "late_hold") { const resources = run.record.checkpoints.map(c => (c.players.find(p => p.id === 6)!.privateState.abilities as any)?.["gift:black-market"]).filter(Boolean); expect(resources.some(a => a.startsOnDay === 3 && a.lastUsedDay === 3 && a.uses === 0 && a.state.poison === 1)).toBe(true); expect(resources.at(-1)).toMatchObject({ uses: 1, state: { poison: 0 } }); }
    if (kind === "hidden_backlash") expect(events.filter(e => e.type === "seer_checked").map(e => e.payload.result)).toEqual([{ kind: "camp", camp: "good" }, { kind: "camp", camp: "wolf" }]);
    if (kind === "gun_poison" || kind === "gun_compound") { expect(events.filter(e => e.type === "player_shot")).toEqual([]); const gun = Object.values(run.record.checkpoints.at(-1)!.players.find(p => p.id === 4)!.privateState.deathAbilities as Record<string, any>)[0]; expect(gun).toMatchObject({ armedOnNight: 1, remaining: 0, disabled: true, deathExpired: true }); }
    if (["native_double", "native_pass", "last_wolf", "last_god"].includes(kind)) {
      const shots = events.filter(e => e.type === "hunter_shot" || e.type === "player_shot"); expect(shots.map(e => [e.type, e.payload.targetId])).toEqual(kind === "native_double" ? [["hunter_shot", 1], ["player_shot", 2]] : kind === "native_pass" ? [["player_shot", 1]] : kind === "last_wolf" ? [["hunter_shot", 1], ["player_shot", 5]] : [["hunter_shot", 3], ["player_shot", 1]]);
      expect(events.indexOf(shots.at(-1)!)).toBeLessThan(events.findIndex(e => e.type === "game_over"));
    }
    if (kind.startsWith("twelve")) { const transfers = events.filter(e => e.type === "sheriff_badge_transferred"); expect(transfers.map(e => [e.payload.fromId, e.payload.toId, e.payload.reason])).toEqual(kind === "twelve_gun" ? [[7, 1, "night_death"], [1, 5, "voting_death"]] : [[7, 1, "night_death"], [1, 6, "voted_out"]]); if (kind === "twelve_gun") expect(events.filter(e => e.type === "player_shot" || e.type === "wolf_king_shot").map(e => [e.type, e.payload.actorId ?? e.payload.wolfKingId, e.payload.targetId])).toEqual([["player_shot", 9, 2], ["wolf_king_shot", 4, 1]]); }
    for (const view of run.views) { expect(view.timeline.filter(row => row.kind === "event" && row.event.type === "black_market_trade_resolved")).toHaveLength(0); expect(view.timeline.filter(row => row.kind === "event" && row.event.type === "black_market_trade_committed")).toHaveLength(view.player_id === merchant ? 1 : 0); }
    expect(events.filter(e => e.type === "black_market_trade_skipped").map(e => e.payload.day)).toEqual(kind === "late_hold" ? [1] : []);
    expect([...run.rejected.values()].reduce((a, b) => a + b, 0) + run.acpTraces.reduce((sum, row) => sum + row.trace.rejected, 0)).toBe(["check_duplicate", "poison_duplicate"].includes(kind) ? 1 : 0);
    expect(events.at(-1)!.type).toBe("game_over");
    if (transport === "llm" && ["twelve_gun", "twelve_backlash", "last_god", "check_duplicate", "late_hold"].includes(kind)) await writeFile(`/tmp/awa-black-${kind}-${locale}.replay.json`, JSON.stringify(run.replay));
  }
  expect(runs[0].result).toEqual(runs[1].result); expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
}, 120000);
