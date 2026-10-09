import type { VictoryPoint } from "@ai-werewolf-arena/game-catalog";
import { ActionWindow, Camp, DeathCause, Phase } from "../../src/core";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { whiteWolfScenario, type WhiteWolfScenario } from "../support/white_wolf_king_scenarios";
import { runTransportGame } from "../support/run_transport_game";

const cases: Array<[WhiteWolfScenario, ActionWindow]> = Object.values(ActionWindow).map(
  (window) => ["hunter", window],
);
for (const kind of [
  "none",
  "pending_poison",
  "pending_knife",
  "wolf_king",
  "twelve",
] as WhiteWolfScenario[])
  cases.push([kind, ActionWindow.OnPreVote]);
for (const [kind, window] of cases)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${window}/${transport}: actual bilingual White Wolf King full games and strict Tape match literal outcomes`, async () => {
      const results: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const run = await runTransportGame(whiteWolfScenario(kind, window), transport, locale);
        results.push(run);
        const events = run.replay.events,
          white = kind === "twelve" ? 2 : 1,
          pending = kind === "pending_poison" || kind === "pending_knife";
        const winners = kind === "twelve" ? [5, 6, 7, 8, 9, 10, 11, 12] : [3, 4, 5, 6];
        const point: VictoryPoint =
          kind === "none"
            ? { day: 2, phase: Phase.Day, checkpoint: "night_settled" }
            : {
                day: kind === "twelve" ? 2 : 1,
                phase: pending
                  ? Phase.Day
                  : window === ActionWindow.OnPreVote
                    ? Phase.Voting
                    : Phase.Day,
                checkpoint: "day_interrupted",
              };
        expect(run.result.snapshot.result).toEqual({
          winner: Camp.Good,
          reason: "all_wolves_eliminated",
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction: Camp.Good, winningPlayerIds: winners },
            additional: [],
            winningPlayerIds: winners,
          },
          decidedAt: point,
        });
        const alive =
          kind === "twelve"
            ? [5, 6, 8, 9, 11, 12]
            : kind === "pending_poison"
              ? [3, 4, 6]
              : kind === "pending_knife"
                ? [3, 4, 5, 6]
                : kind === "wolf_king"
                  ? [6]
                  : [3, 6];
        expect(
          run.manifest.players.filter((player) => player.alive).map((player) => player.player_id),
        ).toEqual(alive);
        expect(
          events
            .filter((event) => event.type === "white_wolf_king_self_destruct")
            .map((event) => event.payload),
        ).toEqual(
          pending
            ? []
            : [
                {
                  actorId: white,
                  targetId:
                    kind === "none" ? null : kind === "wolf_king" ? 2 : kind === "twelve" ? 10 : 4,
                  window,
                },
              ],
        );
        const guns =
          kind === "twelve"
            ? [{ hunterId: 7, targetId: 3 }]
            : pending
              ? []
              : [{ hunterId: 4, targetId: kind === "wolf_king" ? 3 : 2 }];
        expect(
          events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
        ).toEqual(guns);
        expect(
          events.filter((event) => event.type === "wolf_king_shot").map((event) => event.payload),
        ).toEqual(kind === "wolf_king" ? [{ actorId: 2, targetId: 4 }] : []);
        const words =
          kind === "pending_poison"
            ? [1, 5]
            : kind === "pending_knife"
              ? [1]
              : kind === "twelve"
                ? []
                : [5];
        expect(
          events
            .filter((event) => event.type === "last_words_spoken")
            .map((event) => event.payload.playerId),
        ).toEqual(words);
        expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (guns.length)
          expect(events.findIndex((event) => event.type === "hunter_shot")).toBeLessThan(
            events.findIndex((event) => event.type === "game_over"),
          );
        const whiteState = run.record.checkpoints
          .at(-1)!
          .players.find((player) => player.id === white)!;
        expect(whiteState.privateState.white_wolf_king).toEqual({ canDetonate: pending });
        expect(
          (run.rejected.get(white) ?? 0) +
            (run.acpTraces.find((item) => item.actor === white)?.trace.rejected ?? 0),
        ).toBe(1);
        expect(
          run.record.decisions.filter(
            (decision) =>
              decision.actorId === white &&
              decision.request.allowedTools.includes("self_destruct_with_target"),
          ),
        ).toHaveLength(1);
        if (pending) {
          expect(
            run.record.decisions.some((decision) => decision.stage === "sheriff_nomination"),
          ).toBe(false);
          expect(
            events
              .filter((event) => event.type === "wolf_self_destruct")
              .map((event) => event.payload.wolfId),
          ).toEqual([2]);
        }
        if (kind === "twelve") {
          expect(events.some((event) => event.type === "voted_out")).toBe(false);
          expect(
            events
              .filter((event) => event.type === "wolf_self_destruct")
              .map((event) => event.payload.wolfId),
          ).toEqual([1]);
          expect(
            events
              .filter((event) => event.type === "seer_checked")
              .map((event) => event.payload.targetId),
          ).toEqual([2, 1]);
          expect(
            run.views
              .find((view) => view.player_id === white)!
              .timeline.some(
                (entry) =>
                  entry.kind === "event" &&
                  entry.day === 2 &&
                  [
                    "wolf_tactical_order",
                    "wolf_discussion",
                    "wolf_discussion_ended",
                    "wolf_kill_vote_cast",
                  ].includes(entry.event.type),
              ),
          ).toBe(false);
        }
        if (kind === "hunter" && window === ActionWindow.OnPreVote && transport === "llm")
          await writeFile(
            `/tmp/awa-p5-white-wolf-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof results)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...event }) => event);
      expect(results[0].result).toEqual(results[1].result);
      expect(neutral(results[0].replay.events)).toEqual(neutral(results[1].replay.events));
      expect(results[0].record.checkpoints).toEqual(results[1].record.checkpoints);
    }, 120000);
