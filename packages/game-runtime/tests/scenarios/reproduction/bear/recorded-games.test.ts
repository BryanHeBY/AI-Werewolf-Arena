/**
 * 复现场景验证熊的完整录制对局保留匿名开夜信号及相邻目标原生命。
 * 输入为原场景／传输／语言矩阵，以及手写吼叫、存活者、枪击和遗言表。
 * 输出与预期为字面信号时点、死亡链及终局断言，并绑定真实录制前缀和重放；存活预期来自声明表。
 */
import { Camp, DeathCause, Phase } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import {
  BEAR_CASES,
  bearScenario,
  type BearScenario,
} from "../../../support/features/bear/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
const facts: Record<
  BearScenario,
  {
    alive: number[];
    words: number[];
    roars: boolean[];
    day: number;
    night?: boolean;
    early?: boolean;
    wolf?: boolean;
    shots?: number[][];
  }
> = {
  positive: { alive: [1, 3, 4, 5], words: [6, 2], roars: [true], day: 1 },
  quiet: { alive: [1, 2, 4, 5], words: [6, 3], roars: [false], day: 1 },
  neighbor_dead: { alive: [1, 3, 4, 5, 6], words: [2], roars: [true], day: 1, night: true },
  neighbor_update: {
    alive: [1, 3, 6],
    words: [2],
    roars: [true, false],
    day: 2,
    night: true,
    shots: [[5, 4]],
  },
  knife: { alive: [3, 4, 5, 6], words: [1, 2], roars: [false], day: 1 },
  poison: { alive: [3, 4, 5, 6], words: [1, 2], roars: [false], day: 1 },
  dream: { alive: [3, 5, 6], words: [4, 1, 2], roars: [false], day: 1 },
  charm: { alive: [3, 4, 5], words: [2, 6], roars: [false], day: 1, night: true },
  night_shot: { alive: [3, 5, 6], words: [4, 2], roars: [false], day: 1, shots: [[4, 1]] },
  king_badge: { alive: [3, 4, 5, 6], words: [2], roars: [false], day: 1, night: true },
  early_white: { alive: [3, 4, 5], words: [6], roars: [false], day: 1, early: true, wolf: true },
  day_dead: { alive: [3, 4, 5], words: [1, 2], roars: [true, false], day: 2 },
  twelve: {
    alive: [5, 6, 8, 9, 10, 11, 12],
    words: [4, 1],
    roars: [true, true],
    day: 2,
    shots: [[7, 2]],
  },
};
for (const kind of BEAR_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: actual bilingual Bear complete games keep anonymous night-start signals, timing, original lives and strict replay`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = bearScenario(kind),
          run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const oracle = facts[kind],
          events = run.replay.events,
          bear = kind === "twelve" ? 5 : 1,
          reports = oracle.roars.map((roared, idx) => ({ day: idx + 1, roared }));
        expect(
          events.filter((event) => event.type === "bear_roared").map((event) => event.payload),
        ).toEqual(reports);
        expect(
          events
            .filter((event) => event.type === "last_words_spoken")
            .map((event) => event.payload.playerId),
        ).toEqual(oracle.words);
        expect(
          run.manifest.players.filter((player) => player.alive).map((player) => player.player_id),
        ).toEqual(oracle.alive);
        expect(
          events
            .filter((event) => event.type === "hunter_shot")
            .map((event) => [event.payload.hunterId, event.payload.targetId]),
        ).toEqual(oracle.shots ?? []);
        expect(
          events
            .filter((event) => event.type === "wolf_king_shot")
            .map((event) => [event.payload.actorId, event.payload.targetId]),
        ).toEqual(kind === "king_badge" ? [[2, 1]] : []);
        expect(
          events
            .filter((event) => event.type === "charm_death")
            .map((event) => event.payload.targetId),
        ).toEqual(kind === "charm" ? [1] : []);
        expect(
          events
            .filter((event) => event.type === "dream_death")
            .map((event) => event.payload.targetId),
        ).toEqual(kind === "dream" ? [1] : []);
        const wolves = scenario.roles.flatMap((role, index) =>
            ["wolf", "wolf_beauty", "wolf_king", "white_wolf_king"].includes(role)
              ? [index + 1]
              : [],
          ),
          winners = oracle.wolf
            ? wolves
            : scenario.roles.flatMap((_, index) =>
                !wolves.includes(index + 1) ? [index + 1] : [],
              ),
          faction = oracle.wolf ? Camp.Wolf : Camp.Good;
        expect(run.result.snapshot.result).toEqual({
          winner: faction,
          reason: oracle.wolf ? "slaughter_side_completed" : "all_wolves_eliminated",
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction, winningPlayerIds: winners },
            additional: [],
            winningPlayerIds: winners,
          },
          decidedAt: {
            day: oracle.day,
            phase: oracle.night || oracle.early ? Phase.Day : Phase.Voting,
            checkpoint: oracle.early
              ? "day_interrupted"
              : oracle.night
                ? "night_settled"
                : "exile_settled",
          },
        });
        expect(
          run.record.checkpoints.at(-1)!.players.find((player) => player.id === bear)!.privateState
            .bear,
        ).toEqual({ history: reports });
        for (const view of run.views)
          expect(
            view.timeline
              .filter((entry) => entry.kind === "event" && entry.event.type === "bear_roared")
              .map((entry) => (entry.kind === "event" ? entry.event.payload : null)),
          ).toEqual(reports);
        for (const report of events.filter((e) => e.type === "bear_roared")) {
          const index = events.indexOf(report);
          expect(index).toBeGreaterThan(
            events.findIndex((e) => e.type === "night_resolved" && e.day === report.day),
          );
          for (const e of events.filter(
            (e) =>
              e.day === report.day &&
              [
                "hunter_shot",
                "wolf_king_shot",
                "dream_death",
                "charm_death",
                "additional_deaths",
              ].includes(e.type),
          ))
            expect(events.indexOf(e)).toBeLessThan(index);
        }
        if (kind === "king_badge") {
          const badge = events.findIndex((e) => e.type === "sheriff_badge_transferred");
          expect(events[badge].payload).toMatchObject({ fromId: 1, toId: 3 });
          expect(badge).toBeLessThan(events.findIndex((e) => e.type === "bear_roared"));
        }
        expect(
          events
            .filter((e) => e.type === "bear_roared")
            .every((e) => events.indexOf(e) < events.findIndex((e) => e.type === "game_over")),
        ).toBe(true);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
        if (["neighbor_update", "king_badge", "twelve"].includes(kind) && transport === "llm")
          await writeFile(
            `/tmp/awa-p6-bear-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...event }) => event);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
