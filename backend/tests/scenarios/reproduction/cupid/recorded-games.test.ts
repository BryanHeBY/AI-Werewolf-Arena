/**
 * Reproduction scenarios verify Cupid complete recorded games retain private recognition, heartbreak chains and declared group or faction winners.
 * Input: Original policy/scenario/transport/locale matrices and handwritten survivor, death-wave, checkpoint and winning-member facts.
 * Output and oracle: Explicit relationship visibility and chain-final result assertions preserve exact action replay; the declared winner table is independent of observed engine output.
 */
import { expect, test } from "bun:test";
import { Camp, Phase } from "../../../../src/core";
import { CUPID_CASES, cupidScenario } from "../../../support/cupid_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
import { promises as fs } from "node:fs";
const manual = {
  mixed_netease: {
    alive: [1, 2, 3],
    winners: [1, 2, 3],
    group: true,
    phase: Phase.Voting as const,
    day: 1,
    night: [[4]],
    extra: [],
  },
  mixed_lui: {
    alive: [2, 3],
    winners: [2, 3],
    group: true,
    phase: Phase.Day as const,
    day: 2,
    night: [[4], [1]],
    extra: [],
  },
  wolves_netease: {
    alive: [1, 2, 3],
    winners: [1, 2, 3],
    group: false,
    phase: Phase.Voting as const,
    day: 1,
    night: [[4]],
    extra: [],
  },
  wolves_lui: {
    alive: [2, 3],
    winners: [2, 3],
    group: false,
    phase: Phase.Day as const,
    day: 2,
    night: [[4], [1]],
    extra: [],
  },
  root_hunter: {
    alive: [4, 5],
    winners: [1, 2, 4, 5],
    group: false,
    phase: Phase.Day as const,
    day: 1,
    night: [[2]],
    extra: [[1]],
  },
  heartbreak_hunter: {
    alive: [1, 4, 5],
    winners: [4, 5],
    group: false,
    phase: Phase.Day as const,
    day: 1,
    night: [[3]],
    extra: [[2]],
  },
  two_sources: {
    alive: [4, 5],
    winners: [1, 2, 4, 5],
    group: false,
    phase: Phase.Voting as const,
    day: 1,
    night: [[1, 2]],
    extra: [],
  },
  dream_chain: {
    alive: [5],
    winners: [1, 2, 4, 5],
    group: false,
    phase: Phase.Voting as const,
    day: 1,
    night: [[1]],
    extra: [[2, 4]],
  },
  shot_chain: {
    alive: [1, 6],
    winners: [6],
    group: false,
    phase: Phase.Day as const,
    day: 1,
    night: [[2]],
    extra: [[4]],
  },
  beauty_poison: {
    alive: [4, 5],
    winners: [4, 5],
    group: false,
    phase: Phase.Voting as const,
    day: 1,
    night: [[1, 2]],
    extra: [],
  },
};
for (const kind of CUPID_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: complete bilingual SDK/ACP-MCP, private recognition, chain-final winners and strict Tape`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const run = await runTransportGame(cupidScenario(kind), transport, locale),
          oracle = manual[kind],
          events = run.replay.events;
        const wolfWin = kind.startsWith("wolves_") || kind === "shot_chain";
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          oracle.alive,
        );
        expect(
          events
            .filter((event) => event.type === "night_resolved")
            .map((event) => event.payload.deaths),
        ).toEqual(oracle.night);
        expect(
          events
            .filter((event) => event.type === "additional_deaths")
            .map((event) => event.payload.deaths),
        ).toEqual(oracle.extra);
        expect(run.result.snapshot.result).toEqual({
          winner: oracle.group ? null : wolfWin ? Camp.Wolf : Camp.Good,
          reason: oracle.group
            ? "cupid_lovers_only_survivors"
            : wolfWin
              ? "all_good_eliminated"
              : "all_wolves_eliminated",
          outcome: {
            kind: "victory",
            primary: oracle.group
              ? { kind: "relationship", groupId: "cupid_lovers", winningPlayerIds: oracle.winners }
              : {
                  kind: "faction",
                  faction: wolfWin ? Camp.Wolf : Camp.Good,
                  winningPlayerIds: oracle.winners,
                },
            additional: [],
            winningPlayerIds: oracle.winners,
          },
          decidedAt: {
            day: oracle.day,
            phase: oracle.phase,
            checkpoint: oracle.phase === Phase.Day ? "night_settled" : "exile_settled",
          },
        });
        expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        expect(
          events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
        ).toEqual(
          ["root_hunter", "shot_chain"].includes(kind) ? [{ hunterId: 2, targetId: 3 }] : [],
        );
        expect(
          events.filter((event) => event.type === "wolf_king_shot").map((event) => event.payload),
        ).toEqual(kind === "shot_chain" ? [{ actorId: 3, targetId: 5 }] : []);
        if (kind === "shot_chain")
          expect(events.findIndex((event) => event.type === "wolf_king_shot")).toBeLessThan(
            events.findIndex((event) => event.type === "game_over"),
          );
        if (kind === "dream_chain")
          expect(
            events
              .filter((event) => event.type === "dream_death")
              .map((event) => event.payload.targetId),
          ).toEqual([4]);
        if (kind === "beauty_poison")
          expect(events.some((event) => event.type === "charm_death")).toBe(false);
        const relation = events.find((event) => event.type === "cupid_relation_resolved")!.payload;
        for (const view of run.views) {
          const visible = view.timeline.filter((entry) => entry.kind === "event");
          expect(JSON.stringify(visible)).not.toContain("pairCamps");
          expect(
            visible.some(
              (entry) =>
                entry.kind === "event" &&
                ["cupid_relation_resolved", "lovers_death"].includes(entry.event.type),
            ),
          ).toBe(false);
          const ownRecognition = visible.filter(
            (entry) => entry.kind === "event" && entry.event.type === "lover_recognized",
          );
          expect(ownRecognition).toHaveLength(
            (relation.pairIds as number[]).includes(view.player_id) ? 1 : 0,
          );
          for (const entry of ownRecognition)
            if (entry.kind === "event")
              expect(Object.keys(entry.event.payload).sort()).toEqual(["actorId", "partnerId"]);
        }
        const request = run.record.decisions.find(
          (decision) => decision.stage === "cupid",
        )!.request;
        expect(request.context.allow_fallback).toBe(false);
        expect(request.context.turn_constraints.min_valid_actions).toBe(1);
        expect(run.record.checkpoints.at(-1)!.players.find((p) => p.id === 1)!.lovers).toEqual(
          relation as any,
        );
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((r) => r.trace.rejected === 0)).toBe(true);
        if (
          transport === "llm" &&
          ["mixed_netease", "mixed_lui", "root_hunter", "dream_chain"].includes(kind)
        )
          await fs.writeFile(
            `/tmp/awa-p8-cupid-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
    }, 30000);
