/**
 * Reproduction scenarios verify Wolf Beauty complete recorded games preserve charm, coupled deaths and private state through final settlement.
 * Input: Original scenario/transport/locale matrices and handwritten charm choices, extra death waves, survivors and last-word facts.
 * Output and oracle: Literal effect, privacy and chain-final outcome assertions remain attached to exact action replay; no production result is reused to manufacture expected state.
 */
import { Camp, DeathCause, Phase } from "../../../../src/core";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { BEAUTY_CASES, wolfBeautyScenario, type BeautyScenario } from "../../../support/features/wolf-beauty/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
const facts: Record<
  BeautyScenario,
  {
    alive: number[];
    words: number[];
    choices: (number | null)[];
    charm: number[];
    extra: number[][];
    wolf: boolean;
    special?: boolean;
    day: number;
    night?: boolean;
  }
> = {
  exile: {
    alive: [2, 3, 4],
    words: [6, 1],
    choices: [5],
    charm: [5],
    extra: [[5]],
    wolf: true,
    day: 1,
  },
  poison: {
    alive: [2, 3, 4],
    words: [1, 6],
    choices: [5],
    charm: [5],
    extra: [[5]],
    wolf: true,
    day: 1,
    night: true,
  },
  duel: {
    alive: [3, 4, 5],
    words: [6],
    choices: [3],
    charm: [],
    extra: [],
    wolf: false,
    day: 2,
    night: true,
  },
  night_dream_block: {
    alive: [3, 4, 5],
    words: [1, 6, 2],
    choices: [5],
    charm: [],
    extra: [],
    wolf: false,
    day: 1,
  },
  night_dream_chain: {
    alive: [2, 3],
    words: [1, 6],
    choices: [4],
    charm: [4],
    extra: [[4, 5]],
    wolf: true,
    day: 1,
    night: true,
  },
  same_wave: {
    alive: [3, 4, 6],
    words: [1, 5, 2],
    choices: [5],
    charm: [5],
    extra: [],
    wolf: false,
    day: 1,
  },
  last_god: {
    alive: [4, 5, 6],
    words: [3, 1],
    choices: [2],
    charm: [2],
    extra: [[2]],
    wolf: true,
    special: true,
    day: 1,
  },
  last_villager: {
    alive: [2, 4, 5],
    words: [3, 1],
    choices: [6],
    charm: [6],
    extra: [[6]],
    wolf: true,
    special: true,
    day: 1,
  },
  city_first: {
    alive: [4, 5, 6],
    words: [3, 1],
    choices: [2],
    charm: [2],
    extra: [[2]],
    wolf: false,
    day: 1,
  },
  side_first: {
    alive: [4, 5, 6],
    words: [3, 1],
    choices: [2],
    charm: [2],
    extra: [[2]],
    wolf: true,
    special: true,
    day: 1,
  },
  skip: {
    alive: [3, 4],
    words: [2, 1],
    choices: [5, null, 5],
    charm: [5],
    extra: [[5]],
    wolf: true,
    special: true,
    day: 3,
  },
  twelve: {
    alive: [5, 6, 8, 10, 11],
    words: [2, 4, 1],
    choices: [null, 11, 12],
    charm: [12],
    extra: [[12]],
    wolf: false,
    day: 3,
  },
};
for (const kind of BEAUTY_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: actual bilingual Beauty complete games preserve literal effects, private state and strict replay`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = wolfBeautyScenario(kind),
          run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const oracle = facts[kind],
          events = run.replay.events;
        expect(
          events
            .filter((event) => event.type === "charm_applied")
            .map((event) => [event.payload.actorId, event.payload.targetId, event.payload.day]),
        ).toEqual(oracle.choices.map((target, idx) => [1, target, idx + 1]));
        expect(
          events
            .filter((event) => event.type === "charm_death")
            .map((event) => [event.payload.actorId, event.payload.targetId]),
        ).toEqual(oracle.charm.map((target) => [1, target]));
        expect(
          events
            .filter((event) => event.type === "additional_deaths")
            .map((event) => event.payload.deaths),
        ).toEqual(oracle.extra);
        expect(
          events.filter((event) => event.type === "charm_blocked").map((event) => event.payload),
        ).toEqual(
          kind === "night_dream_block"
            ? [{ actorId: 1, targetId: 5, reason: "night_protection" }]
            : [],
        );
        expect(
          events
            .filter((event) => event.type === "dream_death")
            .map((event) => [event.payload.targetId, event.payload.reason]),
        ).toEqual(kind === "night_dream_chain" ? [[5, "linked"]] : []);
        expect(
          events
            .filter((event) => event.type === "last_words_spoken")
            .map((event) => event.payload.playerId),
        ).toEqual(oracle.words);
        expect(
          events.some((event) => event.type === "hunter_shot" || event.type === "wolf_king_shot"),
        ).toBe(false);
        expect(
          events
            .filter((event) => event.type === "knight_duel")
            .map((event) => [event.payload.actorId, event.payload.targetId]),
        ).toEqual(kind === "duel" ? [[4, 1]] : []);
        const wolves = scenario.roles.flatMap((role, index) =>
            role === "wolf" || role === "wolf_beauty" ? [index + 1] : [],
          ),
          winners = oracle.wolf
            ? wolves
            : scenario.roles.flatMap((_, index) =>
                !wolves.includes(index + 1) ? [index + 1] : [],
              ),
          faction = oracle.wolf ? Camp.Wolf : Camp.Good;
        expect(run.result.snapshot.result).toEqual({
          winner: faction,
          reason: oracle.special
            ? "wolf_beauty_last_exile"
            : oracle.wolf
              ? "slaughter_side_completed"
              : "all_wolves_eliminated",
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction, winningPlayerIds: winners },
            additional: [],
            winningPlayerIds: winners,
          },
          decidedAt: {
            day: oracle.day,
            phase: oracle.night ? Phase.Day : Phase.Voting,
            checkpoint: oracle.night ? "night_settled" : "exile_settled",
          },
        });
        expect(
          run.manifest.players.filter((player) => player.alive).map((player) => player.player_id),
        ).toEqual(oracle.alive);
        expect(
          run.record.checkpoints.at(-1)!.players.find((player) => player.id === 1)!.privateState
            .wolf_beauty,
        ).toEqual({
          targetId: oracle.choices.at(-1),
          lastActedDay: oracle.choices.length,
          history: oracle.choices.map((targetId, idx) => ({ day: idx + 1, targetId })),
        });
        for (const view of run.views) {
          expect(
            view.timeline.filter(
              (entry) => entry.kind === "event" && entry.event.type === "charm_applied",
            ),
          ).toHaveLength(view.player_id === 1 ? oracle.choices.length : 0);
          expect(
            view.timeline.some(
              (entry) =>
                entry.kind === "event" &&
                ["charm_death", "charm_blocked"].includes(entry.event.type),
            ),
          ).toBe(false);
        }
        expect(
          (run.rejected.get(1) ?? 0) +
            (run.acpTraces.find((trace) => trace.actor === 1)?.trace.rejected ?? 0),
        ).toBe(kind === "skip" ? 1 : 0);
        expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (["night_dream_block", "last_god", "twelve"].includes(kind) && transport === "llm")
          await writeFile(
            `/tmp/awa-p6-beauty-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...event }) => event);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
