/**
 * Interaction scenarios verify Mist/Raven self-destruct chains preserve delivered resources, death order and queued-night recording.
 * Input: Original recording variants, locale matrix and controlled blast responses on actual games.
 * Output and oracle: Literal event/role/checkpoint assertions retain chain-final outcomes and action replay; the original variant tables and archived fixtures are unchanged.
 */
import { expect, test } from "bun:test";
import { ActionWindow, Camp, Phase } from "../../../../src/domain";
import { mistRecording, type MistRequestObservation } from "../../../support/features/mist-raven/drivers/recording";
import { type MistRecordVariant } from "../../../support/features/mist-raven/builders/board";
const cases: Array<{ variant: MistRecordVariant; window: ActionWindow; day: number }> = [
  { variant: "blast-pre-election", window: ActionWindow.OnPreElection, day: 1 },
  { variant: "blast-daybreak", window: ActionWindow.OnDaybreak, day: 1 },
  { variant: "blast-speech-gap", window: ActionWindow.OnPerSpeechGap, day: 1 },
  { variant: "blast-pre-vote", window: ActionWindow.OnPreVote, day: 1 },
  { variant: "blast-raw-target", window: ActionWindow.OnPerSpeechGap, day: 1 },
  { variant: "blast-badge-chain", window: ActionWindow.OnPerSpeechGap, day: 1 },
  { variant: "blast-last-wolf", window: ActionWindow.OnDaybreak, day: 3 },
];
for (const c of cases)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Mist real complete blast recording and exact Tape ${c.variant}/${locale}`, async () => {
      const samples: MistRequestObservation[] = [];
      const r = await mistRecording(c.variant, locale, "mist-raven-real-runtime", (s) =>
        samples.push(s),
      );
      const last = r.checkpoints.at(-1)!;
      expect(r.finalized).toBe(true);
      expect(last.snapshot.gameOver).toBe(true);
      expect(last.snapshot.result?.winner).toBe(Camp.Good);
      expect(last.snapshot.result?.reason).toBe("all_wolves_eliminated");
      const lastWolf = c.variant === "blast-last-wolf",
        raw = c.variant === "blast-raw-target";
      const deaths = r.events.filter((e) => e.type === "night_resolved");
      expect(deaths.map((e) => e.payload.deaths)).toEqual(
        lastWolf ? [[11], [9], []] : raw ? [[], [11], [3, 7]] : [[5], [11], [3, 7]],
      );
      const blasts = r.events.filter((e) => e.type === "wolf_self_destruct");
      expect(blasts.map((e) => e.payload)).toEqual([{ wolfId: 10, window: c.window }]);
      expect(r.events.filter((e) => e.type === "voted_out").map((e) => e.payload.target)).toEqual(
        lastWolf ? [12] : [12, 9],
      );
      expect(r.decisions.filter((d) => d.stage === "alchemist_snake").map((d) => d.day)).toEqual([
        1, 2, 3,
      ]);
      expect(
        r.events.filter((e) => e.type === "alchemist_snake_chosen").map((e) => e.payload.targetId),
      ).toEqual(lastWolf ? [null, null, 2] : [null, null, 6]);
      expect(r.events.filter((e) => e.type === "raven_unsealed").map((e) => e.payload)).toEqual([
        {
          actorId: 9,
          day: lastWolf ? 2 : 3,
          awakened: true,
          knownTeammateIds: lastWolf ? [10] : [],
        },
      ]);
      expect(
        r.events.filter((e) => e.type === "raven_knife_chosen").map((e) => e.payload.targetId),
      ).toEqual(lastWolf ? [null] : [3]);
      expect(r.decisions.filter((d) => d.stage === "raven_knife").map((d) => d.day)).toEqual(
        lastWolf ? [2] : [3],
      );
      const damage = r.operations
        .filter((o) => o.scope === "resolution" && o.op === "night_damage_resolved")
        .map((o) => o.output as { death_sources: Record<string, string[]> });
      expect(damage.map((d) => d.death_sources)).toEqual(
        lastWolf
          ? [{ 11: ["wolf_kill"] }, { 9: ["wolf_kill"] }, {}]
          : [
              raw ? {} : { 5: ["wolf_kill"] },
              { 11: ["wolf_kill"] },
              { 3: ["raven_claw_knife"], 7: ["dream"] },
            ],
      );
      const complete = r.checkpoints.filter((cp) => cp.cycle > 0 && cp.complete);
      expect(complete).toHaveLength(3);
      expect(
        complete.map(
          (cp) =>
            (
              cp.players.find((p) => p.id === 1)!.privateState.alchemist as {
                healRemaining: number;
              }
            ).healRemaining,
        ),
      ).toEqual([1, 1, 0]);
      expect(
        complete.map(
          (cp) =>
            (
              cp.players.find((p) => p.id === 9)!.privateState.ravenClaw as {
                extraRemaining: number;
              }
            ).extraRemaining,
        ),
      ).toEqual(lastWolf ? [1, 1, 1] : [1, 1, 0]);
      expect(complete[0]!.snapshot.phase).toBe(lastWolf ? Phase.Voting : Phase.Night);
      const blastIndex = r.events.findIndex((e) => e.type === "wolf_self_destruct");
      const snakeIndex = r.events.findIndex(
        (e) => e.type === "alchemist_snake_chosen" && e.payload.day === c.day,
      );
      const nightIndex = r.events.indexOf(deaths[c.day - 1]!);
      expect(
        c.window === ActionWindow.OnPreVote
          ? snakeIndex < nightIndex && nightIndex < blastIndex
          : blastIndex < snakeIndex && snakeIndex < nightIndex,
      ).toBe(true);
      const snake = samples.find((s) => s.day === c.day && s.stage === "alchemist_snake")!;
      expect(snake.gameOver).toBe(false);
      expect(snake.aliveIds.includes(10)).toBe(c.window === ActionWindow.OnPreVote);
      if (!lastWolf) expect(snake.aliveIds).toContain(5);
      if (!lastWolf)
        for (const sample of samples.filter(
          (s) => s.day === 1 && !s.publishedTypes.includes("night_resolved"),
        )) {
          expect(sample.aliveIds).toContain(5);
          expect(sample.aliveIds.includes(10)).toBe(
            !sample.publishedTypes.includes("wolf_self_destruct"),
          );
          expect(sample.gameOver).toBe(false);
        }
      if (c.window === ActionWindow.OnPreVote) {
        const window = samples.find(
          (s) => s.day === 1 && s.stage === ActionWindow.OnPreVote && s.actorId === 10,
        )!;
        expect(window.aliveIds).not.toContain(5);
        expect(window.publishedTypes.filter((t) => t === "night_resolved")).toHaveLength(1);
      }
      const badges = r.events.filter((e) => e.type === "sheriff_badge_transferred");
      expect(badges.map((e) => e.payload)).toEqual(
        c.window === ActionWindow.OnPreElection
          ? []
          : c.variant === "blast-badge-chain"
            ? [
                { fromId: 10, toId: 5, reason: "self_destruct" },
                { fromId: 5, toId: 6, reason: "night_death" },
              ]
            : [{ fromId: 10, toId: 6, reason: "self_destruct" }],
      );
      if (c.window !== ActionWindow.OnPreElection) {
        const badgeIndex = r.events.indexOf(badges[0]!);
        expect(blastIndex).toBeLessThan(badgeIndex);
        if (c.window !== ActionWindow.OnPreVote) expect(badgeIndex).toBeLessThan(snakeIndex);
        expect(last.players.find((p) => p.id === 6)!.badge.isSheriff).toBe(true);
      }
      if (c.variant === "blast-badge-chain") {
        expect(
          r.decisions
            .filter(
              (d) =>
                d.day === 1 &&
                (d.stage === "sheriff_badge_choice" ||
                  d.stage === "alchemist_snake" ||
                  (d.stage === "last_words" && d.actorId === 5)),
            )
            .map((d) => `${d.stage}:${d.actorId}`),
        ).toEqual([
          "sheriff_badge_choice:10",
          "alchemist_snake:1",
          "last_words:5",
          "sheriff_badge_choice:5",
        ]);
        expect(snake.sheriffIds).toEqual([5]);
        const words = r.events.findIndex(
          (e) => e.type === "last_words_spoken" && e.payload.playerId === 5,
        );
        expect(nightIndex).toBeLessThan(words);
        expect(words).toBeLessThan(r.events.indexOf(badges[1]!));
      }
      if (raw) {
        const request = r.decisions.find(
          (d) => d.day === 1 && d.stage === "alchemist_snake",
        )!.request;
        expect(request.context.snake_target).toBe(10);
        expect(request.context.snake_candidates).toEqual([]);
        expect(deaths.every((e) => !(e.payload.deaths as number[]).includes(10))).toBe(true);
      }
      if (lastWolf) {
        expect(snake.aliveIds).toContain(2);
        expect(snake.publishedTypes.filter((t) => t === "night_resolved")).toHaveLength(2);
        expect(snake.publishedTypes).not.toContain("game_over");
        expect(r.events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(nightIndex).toBeLessThan(r.events.findIndex((e) => e.type === "game_over"));
        expect(r.decisions.some((d) => d.day === 3 && d.stage === "voting")).toBe(false);
        expect(last.players.find((p) => p.id === 2)!.alive).toBe(true);
        expect(last.snapshot.result?.decidedAt).toEqual({
          day: 3,
          phase: Phase.Day,
          checkpoint: "day_interrupted",
        });
      } else expect(r.decisions.some((d) => d.day === 1 && d.stage === "voting")).toBe(false);
    }, 120000);
