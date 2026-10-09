import { Camp, DeathCause, Phase } from "../../src/core";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import {
  GARGOYLE_CASES,
  gargoyleScenario,
  type GargoyleScenario,
} from "../support/gargoyle_scenarios";
import { runTransportGame } from "../support/run_transport_game";
const facts: Record<
  GargoyleScenario,
  {
    alive: number[];
    words: number[];
    day: number;
    night?: boolean;
    wolf?: boolean;
    awake: number | null;
    inherited: boolean;
    roles: string[];
    checks: number;
    grave: string[];
  }
> = {
  day_good: {
    alive: [4, 6],
    words: [5, 2, 1],
    day: 2,
    awake: 1,
    inherited: true,
    roles: ["seer", "gravekeeper"],
    checks: 2,
    grave: ["wolf"],
  },
  night_wolf: {
    alive: [1, 3, 4],
    words: [5, 2],
    day: 2,
    night: true,
    wolf: true,
    awake: 1,
    inherited: true,
    roles: ["seer", "gravekeeper"],
    checks: 2,
    grave: ["wolf"],
  },
  king_link: {
    alive: [3, 4, 5, 6],
    words: [2],
    day: 1,
    night: true,
    awake: 1,
    inherited: true,
    roles: ["seer"],
    checks: 1,
    grave: [],
  },
  same_wave: {
    alive: [3, 4, 5, 6, 7, 8],
    words: [1, 2],
    day: 1,
    night: true,
    awake: null,
    inherited: false,
    roles: ["seer"],
    checks: 1,
    grave: [],
  },
  solo_self: {
    alive: [2, 3, 4, 5, 6],
    words: [1],
    day: 1,
    night: true,
    awake: 1,
    inherited: true,
    roles: ["seer"],
    checks: 1,
    grave: [],
  },
  twelve: {
    alive: [5, 8, 10, 11, 12],
    words: [4, 9, 1],
    day: 3,
    awake: 2,
    inherited: true,
    roles: ["seer", "witch", "gravekeeper"],
    checks: 3,
    grave: ["wolf", "good"],
  },
};
for (const kind of GARGOYLE_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: actual bilingual Gargoyle complete games preserve private role labels, native check-before-knife and strict Tape`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = gargoyleScenario(kind),
          run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const oracle = facts[kind],
          events = run.replay.events;
        expect(events.filter((e) => e.type === "gargoyle_awakened").map((e) => e.payload)).toEqual(
          oracle.awake === null ? [] : [{ actorId: 1, day: oracle.awake }],
        );
        expect(
          run.record.checkpoints.at(-1)!.players.find((p) => p.id === 1)!.privateState.gargoyle,
        ).toEqual({ hasInheritedKnife: oracle.inherited });
        expect(
          events.filter((e) => e.type === "role_inspected").map((e) => e.payload.result),
        ).toEqual(oracle.roles.map((role) => ({ kind: "role", role })));
        expect(
          events.filter((e) => e.type === "seer_checked").map((e) => e.payload.isWerewolf),
        ).toEqual(Array(oracle.checks).fill(true));
        expect(
          events.filter((e) => e.type === "gravekeeper_reported").map((e) => e.payload.result),
        ).toEqual(oracle.grave.map((camp) => ({ kind: "camp", camp })));
        expect(
          events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
        ).toEqual(oracle.words);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          oracle.alive,
        );
        const wolves = scenario.roles.flatMap((r, i) =>
            ["wolf", "wolf_king", "gargoyle"].includes(r) ? [i + 1] : [],
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
        const knives = scenario.turns
          .get(1)!
          .filter((t) => t.stage === "wolf_vote")
          .map((t) => [t.day, t.action?.name === "kill_vote" ? t.action.args.target_id : null]);
        expect(
          events
            .filter((e) => e.type === "wolf_kill_vote_cast" && e.payload.actorId === 1)
            .map((e) => [e.day, e.payload.targetId]),
        ).toEqual(knives);
        for (const e of events.filter(
          (e) => e.type === "wolf_kill_vote_cast" && e.payload.actorId === 1,
        )) {
          expect(
            events.findIndex((x) => x.type === "role_inspected" && x.day === e.day),
          ).toBeLessThan(events.indexOf(e));
        }
        expect(
          events.some(
            (e) =>
              ["wolf_discussion", "wolf_discussion_ended"].includes(e.type) &&
              e.payload.actorId === 1,
          ),
        ).toBe(false);
        for (const view of run.views) {
          expect(
            view.timeline.filter((e) => e.kind === "event" && e.event.type === "role_inspected"),
          ).toHaveLength(view.player_id === 1 ? oracle.roles.length : 0);
          expect(
            view.timeline.filter((e) => e.kind === "event" && e.event.type === "gargoyle_awakened"),
          ).toHaveLength(view.player_id === 1 && oracle.awake !== null ? 1 : 0);
        }
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (["king_link", "twelve"].includes(kind) && transport === "llm")
          await writeFile(
            `/tmp/awa-p6-garg-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...e }) => e);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
