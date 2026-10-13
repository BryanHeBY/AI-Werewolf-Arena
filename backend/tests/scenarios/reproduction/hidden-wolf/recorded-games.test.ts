/**
 * Reproduction scenarios verify Hidden Wolf complete recorded games retain one-way knowledge, masking and actual knife inheritance.
 * Input: Original scenario/transport/locale matrices with handwritten check, roar, awakening, survivor and last-word facts.
 * Output and oracle: Literal private-view, inheritance and chain-final outcome assertions remain attached to the real replay; expected survivors are not generated from another World.
 */
import { Camp, DeathCause, Phase } from "../../../../src/core";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { HIDDEN_CASES, hiddenWolfScenario, type HiddenScenario } from "../../../support/features/hidden-wolf/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
const facts: Record<
  HiddenScenario,
  {
    alive: number[];
    words: number[];
    day: number;
    night?: boolean;
    wolf?: boolean;
    awake: number | null;
    inherited: boolean;
    checks: boolean[];
    roars: boolean[];
  }
> = {
  day_good: {
    alive: [4, 6],
    words: [5, 2, 1],
    day: 2,
    awake: 1,
    inherited: true,
    checks: [false, true],
    roars: [false, false],
  },
  night_wolf: {
    alive: [1, 3, 4],
    words: [5, 2],
    day: 2,
    night: true,
    wolf: true,
    awake: 1,
    inherited: true,
    checks: [false, true],
    roars: [false, false],
  },
  bear_update: {
    alive: [1, 5, 6],
    words: [3, 2],
    day: 2,
    awake: 1,
    inherited: true,
    checks: [false, true],
    roars: [false, true],
  },
  night_inherit: {
    alive: [4, 5, 6],
    words: [2, 1],
    day: 2,
    awake: 1,
    inherited: true,
    checks: [false, true],
    roars: [false, false],
  },
  masked_exile: {
    alive: [3, 4, 5],
    words: [6, 1],
    day: 2,
    night: true,
    awake: null,
    inherited: false,
    checks: [],
    roars: [],
  },
  knight: {
    alive: [3, 4, 5],
    words: [6],
    day: 2,
    night: true,
    awake: null,
    inherited: false,
    checks: [],
    roars: [],
  },
  king_link: {
    alive: [3, 4, 5, 6],
    words: [2],
    day: 1,
    night: true,
    awake: 1,
    inherited: true,
    checks: [false],
    roars: [false],
  },
  same_wave: {
    alive: [3, 4, 5, 6, 7, 8],
    words: [1, 2],
    day: 1,
    night: true,
    awake: null,
    inherited: false,
    checks: [false],
    roars: [false],
  },
  solo_guard: {
    alive: [2, 3, 4, 5, 6],
    words: [1],
    day: 1,
    awake: 1,
    inherited: true,
    checks: [true],
    roars: [false],
  },
  solo_self: {
    alive: [2, 3, 4, 5, 6],
    words: [1],
    day: 1,
    night: true,
    awake: 1,
    inherited: true,
    checks: [true],
    roars: [false],
  },
  twelve: {
    alive: [5, 8, 10, 11, 12],
    words: [4, 9, 1],
    day: 3,
    awake: 2,
    inherited: true,
    checks: [],
    roars: [true, true, true],
  },
  poison_inherit: {
    alive: [4, 5, 7, 8],
    words: [2, 6, 1],
    day: 2,
    awake: 1,
    inherited: true,
    checks: [false, true],
    roars: [false, false],
  },
};
for (const kind of HIDDEN_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: actual bilingual Hidden Wolf complete games preserve unilateral knowledge, real inheritance, mask and strict replay`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = hiddenWolfScenario(kind),
          run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const oracle = facts[kind],
          events = run.replay.events,
          hidden = kind === "bear_update" ? 2 : 1;
        expect(
          events.filter((e) => e.type === "hidden_wolf_awakened").map((e) => e.payload),
        ).toEqual(oracle.awake === null ? [] : [{ actorId: hidden, day: oracle.awake }]);
        expect(
          run.record.checkpoints.at(-1)!.players.find((p) => p.id === hidden)!.privateState
            .hidden_wolf,
        ).toEqual({ hasInheritedKnife: oracle.inherited });
        expect(
          events.filter((e) => e.type === "seer_checked").map((e) => e.payload.isWerewolf),
        ).toEqual(oracle.checks);
        expect(events.filter((e) => e.type === "bear_roared").map((e) => e.payload.roared)).toEqual(
          oracle.roars,
        );
        expect(
          events.filter((e) => e.type === "gravekeeper_reported").map((e) => e.payload.result),
        ).toEqual(kind === "masked_exile" ? [{ kind: "camp", camp: "good" }] : []);
        expect(events.filter((e) => e.type === "knight_duel").map((e) => e.payload)).toEqual(
          kind === "knight" ? [{ actorId: 3, targetId: 1, result: "wolf" }] : [],
        );
        expect(
          events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
        ).toEqual(oracle.words);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          oracle.alive,
        );
        const wolves = scenario.roles.flatMap((r, i) =>
            ["wolf", "wolf_king", "hidden_wolf"].includes(r) ? [i + 1] : [],
          ),
          winners = oracle.wolf
            ? wolves
            : scenario.roles.flatMap((_, i) => (!wolves.includes(i + 1) ? [i + 1] : [])),
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
            phase: oracle.night ? Phase.Day : Phase.Voting,
            checkpoint: oracle.night ? "night_settled" : "exile_settled",
          },
        });
        const wantedKnife = scenario.turns
          .get(hidden)!
          .filter((t) => t.stage === "wolf_vote")
          .map((t) => [t.day, t.action?.name === "kill_vote" ? t.action.args.target_id : null]);
        expect(
          events
            .filter((e) => e.type === "wolf_kill_vote_cast" && e.payload.actorId === hidden)
            .map((e) => [e.day, e.payload.targetId]),
        ).toEqual(wantedKnife);
        expect(
          events.some(
            (e) =>
              ["wolf_discussion", "wolf_discussion_ended"].includes(e.type) &&
              e.payload.actorId === hidden,
          ),
        ).toBe(false);
        for (const view of run.views) {
          expect(
            view.timeline.filter(
              (entry) => entry.kind === "event" && entry.event.type === "hidden_wolf_awakened",
            ),
          ).toHaveLength(view.player_id === hidden && oracle.awake !== null ? 1 : 0);
          if (view.player_id === hidden)
            expect(
              view.timeline
                .filter(
                  (entry) =>
                    entry.kind === "event" &&
                    [
                      "wolf_tactical_order",
                      "wolf_discussion",
                      "wolf_discussion_ended",
                      "wolf_kill_vote_cast",
                    ].includes(entry.event.type),
                )
                .every(
                  (entry) =>
                    entry.kind === "event" &&
                    entry.event.type === "wolf_kill_vote_cast" &&
                    entry.event.payload.actorId === hidden,
                ),
            ).toBe(true);
        }
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (["king_link", "twelve", "bear_update"].includes(kind) && transport === "llm")
          await writeFile(
            `/tmp/awa-p6-hidden-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...e }) => e);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
