/**
 * 复现场景验证摄梦人完整录制对局保留保护、关联死亡及私有资源历史。
 * 输入为原场景／传输／语言矩阵，以及手写存活者、梦、死因、checkpoint 和遗言事实。
 * 输出与预期为字面效果／知识／消耗及终局断言，保留精确行动重放；预期结果仍由既有表提供。
 */
import { Camp, DeathCause, Phase } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { DREAMER_CASES, dreamerScenario, type DreamerScenario } from "../../../support/features/dreamer/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
const facts: {
  [K in DreamerScenario]: {
    alive: number[];
    words: number[];
    dreams: number[];
    reasons: Array<[number, string]>;
    day: number;
    phase: Phase.Day | "voting";
    checkpoint: "night_settled" | "exile_settled";
  };
} = {
  protected: {
    alive: [1, 3, 4, 5, 6],
    words: [2],
    dreams: [5],
    reasons: [],
    day: 1,
    phase: Phase.Voting,
    checkpoint: "exile_settled",
  },
  knife_link: {
    alive: [3, 4, 6],
    words: [1, 5, 2],
    dreams: [5],
    reasons: [[5, "linked"]],
    day: 1,
    phase: Phase.Voting,
    checkpoint: "exile_settled",
  },
  saved: {
    alive: [1, 3, 4, 5, 6],
    words: [2],
    dreams: [5],
    reasons: [],
    day: 1,
    phase: Phase.Voting,
    checkpoint: "exile_settled",
  },
  poison_link: {
    alive: [3, 5, 6],
    words: [1, 4, 2],
    dreams: [4],
    reasons: [[4, "linked"]],
    day: 1,
    phase: Phase.Voting,
    checkpoint: "exile_settled",
  },
  gun_blocked: {
    alive: [1, 3, 5, 6],
    words: [4, 2],
    dreams: [5],
    reasons: [],
    day: 1,
    phase: Phase.Voting,
    checkpoint: "exile_settled",
  },
  gun_link: {
    alive: [3, 6],
    words: [4, 2],
    dreams: [5],
    reasons: [[5, "linked"]],
    day: 1,
    phase: Phase.Voting,
    checkpoint: "exile_settled",
  },
  consecutive: {
    alive: [1, 3, 4, 6],
    words: [2],
    dreams: [5, 5],
    reasons: [[5, "consecutive"]],
    day: 2,
    phase: Phase.Voting,
    checkpoint: "exile_settled",
  },
  king_repeat: {
    alive: [1, 3, 4, 5, 6],
    words: [],
    dreams: [2, 2],
    reasons: [[2, "consecutive"]],
    day: 2,
    phase: Phase.Day,
    checkpoint: "night_settled",
  },
  twelve: {
    alive: [6, 8, 10, 11, 12],
    words: [1, 5],
    dreams: [10, 2, 2],
    reasons: [[2, "consecutive"]],
    day: 3,
    phase: Phase.Day,
    checkpoint: "night_settled",
  },
};
for (const kind of DREAMER_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: actual bilingual dream complete games preserve literal effects, private prompts, resources and strict replay`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const run = await runTransportGame(dreamerScenario(kind), transport, locale);
        runs.push(run);
        const oracle = facts[kind],
          events = run.replay.events,
          actor = kind === "twelve" ? 8 : 1;
        expect(
          events
            .filter((event) => event.type === "dream_applied")
            .map((event) => [
              event.payload.actorId,
              event.payload.targetId,
              event.payload.day,
              event.payload.consecutive,
            ]),
        ).toEqual(
          oracle.dreams.map((target, idx) => [
            actor,
            target,
            idx + 1,
            idx > 0 && target === oracle.dreams[idx - 1],
          ]),
        );
        expect(
          events
            .filter((event) => event.type === "dream_death")
            .map((event) => [event.payload.targetId, event.payload.reason]),
        ).toEqual(oracle.reasons);
        expect(
          events
            .filter((event) => event.type === "death_shot_blocked")
            .map((event) => event.payload),
        ).toEqual(
          kind === "gun_blocked" ? [{ actorId: 4, targetId: 5, reason: "night_protection" }] : [],
        );
        expect(
          events
            .filter((event) => event.type === "additional_deaths")
            .map((event) => event.payload),
        ).toEqual(kind === "gun_link" ? [{ deaths: [5] }] : []);
        expect(
          events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
        ).toEqual(
          kind === "gun_link"
            ? [{ hunterId: 4, targetId: 1 }]
            : kind === "twelve"
              ? [{ hunterId: 7, targetId: 3 }]
              : [],
        );
        expect(events.some((event) => event.type === "wolf_king_shot")).toBe(false);
        const winners = kind === "twelve" ? [5, 6, 7, 8, 9, 10, 11, 12] : [1, 3, 4, 5, 6];
        expect(run.result.snapshot.result).toEqual({
          winner: Camp.Good,
          reason: "all_wolves_eliminated",
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction: Camp.Good, winningPlayerIds: winners },
            additional: [],
            winningPlayerIds: winners,
          },
          decidedAt: { day: oracle.day, phase: oracle.phase, checkpoint: oracle.checkpoint },
        });
        expect(
          run.manifest.players.filter((player) => player.alive).map((player) => player.player_id),
        ).toEqual(oracle.alive);
        expect(
          events
            .filter((event) => event.type === "last_words_spoken")
            .map((event) => event.payload.playerId),
        ).toEqual(oracle.words);
        const abilities = run.record.checkpoints
          .at(-1)!
          .players.find((player) => player.id === actor)!.privateState.abilities as Record<
          string,
          { state: unknown; uses: number }
        >;
        expect(abilities["native:dream"].uses).toBe(oracle.dreams.length);
        expect(abilities["native:dream"].state).toEqual({
          lastTarget: oracle.dreams.at(-1),
          lastDay: oracle.dreams.length,
          history: oracle.dreams.map((targetId, idx) => ({ targetId, day: idx + 1 })),
        });
        for (const view of run.views) {
          const privateChoices = view.timeline.filter(
            (entry) => entry.kind === "event" && entry.event.type === "dream_applied",
          );
          expect(privateChoices).toHaveLength(view.player_id === actor ? oracle.dreams.length : 0);
          expect(
            view.timeline.some(
              (entry) => entry.kind === "event" && entry.event.type === "dream_death",
            ),
          ).toBe(false);
        }
        expect(
          (run.rejected.get(actor) ?? 0) +
            (run.acpTraces.find((trace) => trace.actor === actor)?.trace.rejected ?? 0),
        ).toBe(1);
        expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (
          (kind === "gun_link" || kind === "gun_blocked" || kind === "twelve") &&
          transport === "llm"
        )
          await writeFile(
            `/tmp/awa-p6-dream-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...event }) => event);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
