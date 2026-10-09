import type { VictoryPoint } from "@ai-werewolf-arena/game-catalog";
import { Camp, DeathCause, Phase } from "../../src/core";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { wolfKingScenario, type WolfKingScenario } from "../support/wolf_king_scenarios";
import { runTransportGame } from "../support/run_transport_game";

for (const scenario of ["exile_chain", "poison", "twelve", "blast", "shot_chain"] as WolfKingScenario[]) for (const transport of ["llm", "acp", "mixed"] as const) test(`${scenario}/${transport}: real bilingual complete wolf-king games preserve literal outcomes, knowledge and strict Tape`, async () => {
  const results: Awaited<ReturnType<typeof runTransportGame>>[] = [];
  for (const locale of ["zh-CN", "en"] as const) {
    const run = await runTransportGame(wolfKingScenario(scenario), transport, locale); results.push(run);
    const winners = scenario === "twelve" ? [5, 6, 7, 8, 9, 10, 11, 12] : [2, 3, 4, 5, 6];
    const point: VictoryPoint = scenario === "poison" || scenario === "shot_chain" ? { day: 1, phase: Phase.Day, checkpoint: "night_settled" } : scenario === "twelve" || scenario === "blast" ? { day: scenario === "twelve" ? 2 : 1, phase: Phase.Voting, checkpoint: "day_interrupted" } : { day: 1, phase: Phase.Voting, checkpoint: "exile_settled" };
    expect(run.result.snapshot.result).toEqual({ winner: Camp.Good, reason: "all_wolves_eliminated", outcome: { kind: "victory", primary: { kind: "faction", faction: Camp.Good, winningPlayerIds: winners }, additional: [], winningPlayerIds: winners }, decidedAt: point });
    expect(run.manifest.players.filter(player => player.alive).map(player => player.player_id)).toEqual(scenario === "poison" ? [3, 4, 6] : scenario === "twelve" ? [5, 6, 8, 9, 11, 12] : scenario === "blast" ? [2, 3, 4, 6] : scenario === "shot_chain" ? [4, 5, 6] : [4, 6]);
    const events = run.replay.events, king = scenario === "twelve" ? 2 : 1;
    expect(events.filter(event => event.type === "wolf_king_shot").map(event => event.payload)).toEqual(scenario === "poison" || scenario === "blast" ? [] : [{ actorId: king, targetId: scenario === "twelve" ? 10 : scenario === "shot_chain" ? 3 : 2 }]);
    expect(events.filter(event => event.type === "hunter_shot").map(event => event.payload)).toEqual(scenario === "blast" ? [] : [{ hunterId: scenario === "twelve" ? 7 : 2, targetId: scenario === "poison" ? 5 : scenario === "shot_chain" ? 1 : 3 }]);
    expect(events.filter(event => event.type === "game_over")).toHaveLength(1); expect(events.at(-1)!.type).toBe("game_over");
    if (scenario !== "blast") expect(events.findIndex(event => event.type === "hunter_shot")).toBeLessThan(events.findIndex(event => event.type === "game_over"));
    const final = run.record.checkpoints.at(-1)!, kingState = final.players.find(player => player.id === king)!;
    expect(kingState.privateState.wolf_king).toEqual({ canShoot: false }); expect(kingState.privateState).not.toHaveProperty("hunter");
    if (scenario === "exile_chain") {
      expect(events.filter(event => event.type === "sheriff_badge_transferred").map(event => [event.payload.fromId, event.payload.toId])).toEqual([[1, 2], [2, 3], [3, 4]]);
      expect(final.players.filter(player => player.badge.isSheriff).map(player => player.id)).toEqual([4]); expect(final.players.find(player => player.id === 4)!.vote.weight).toBe(2.25);
      expect(events.filter(event => event.type === "last_words_spoken").map(event => event.payload.playerId)).toEqual([5, 1]);
      expect(events.findIndex(event => event.type === "wolf_king_shot")).toBeLessThan(events.findIndex(event => event.type === "hunter_shot"));
    } else if (scenario === "poison") {
      expect(run.record.decisions.some(decision => decision.actorId === king && decision.stage === "death_shot")).toBe(false);
      expect(events.filter(event => event.type === "last_words_spoken").map(event => event.payload.playerId)).toEqual([1, 2]);
      expect(events.filter(event => event.type === "sheriff_badge_transferred").map(event => [event.payload.fromId, event.payload.toId])).toEqual([[1, 3]]);
    } else if (scenario === "twelve") {
      expect(events.filter(event => event.type === "wolf_self_destruct").map(event => event.payload.wolfId)).toEqual([1]);
      expect(events.filter(event => event.type === "seer_checked").map(event => event.payload.targetId)).toEqual([2, 1]);
      expect(run.views.find(view => view.player_id === king)!.timeline.some(entry => entry.kind === "event" && entry.day === 2 && ["wolf_tactical_order", "wolf_discussion", "wolf_discussion_ended", "wolf_kill_vote_cast"].includes(entry.event.type))).toBe(false);
    } else if (scenario === "shot_chain") {
      expect(events.filter(event => event.type === "sheriff_badge_transferred").map(event => [event.payload.fromId, event.payload.toId])).toEqual([[1, 3], [3, 4]]);
      expect(events.filter(event => event.type === "last_words_spoken").map(event => event.payload.playerId)).toEqual([2]);
      expect(events.findIndex(event => event.type === "hunter_shot")).toBeLessThan(events.findIndex(event => event.type === "wolf_king_shot"));
      expect(run.record.decisions.find(decision => decision.actorId === king && decision.stage === "death_shot")!.request.context.death_sources).toEqual([DeathCause.Shot]);
    } else {
      expect(run.record.decisions.some(decision => ["voting", "death_shot", "hunter_shot"].includes(decision.stage))).toBe(false);
      expect(events.filter(event => event.type === "wolf_self_destruct").map(event => event.payload.wolfId)).toEqual([1]);
      expect(events.filter(event => event.type === "last_words_spoken").map(event => event.payload.playerId)).toEqual([5]);
      expect(events.filter(event => event.type === "sheriff_badge_transferred").map(event => [event.payload.fromId, event.payload.toId])).toEqual([[1, 2]]);
    }
    const expectedRejections = scenario === "poison" || scenario === "blast" ? 0 : 1;
    expect((run.rejected.get(king) ?? 0) + (run.acpTraces.find(item => item.actor === king)?.trace.rejected ?? 0)).toBe(expectedRejections);
    if (scenario === "exile_chain" && transport === "llm") await writeFile(`/tmp/awa-p5-wolf-king-${locale}.replay.json`, JSON.stringify(run.replay));
  }
  const neutral = (events: typeof results[0]["replay"]["events"]) => events.map(({ timestamp: _time, ...event }) => event);
  expect(neutral(results[0].replay.events)).toEqual(neutral(results[1].replay.events)); expect(results[0].result).toEqual(results[1].result); expect(results[0].record.checkpoints).toEqual(results[1].record.checkpoints);
}, 120000);
