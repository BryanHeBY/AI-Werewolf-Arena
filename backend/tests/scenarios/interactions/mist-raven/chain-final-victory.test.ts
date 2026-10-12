/**
 * Interaction scenarios verify Mist/Raven chain-final victory waits for actual pending rescue and rejects illegal late self-heal.
 * Input: Original last-villager/last-god recording plans, locale matrix and captured request observations.
 * Output and oracle: Literal terminal timing, live-state, stock and failed-prefix assertions remain tied to actual recordings; failed healing is not repaired into a legal action.
 */
import { expect, test } from "bun:test";
import { Camp, Phase } from "../../../../src/core";
import {
  mistRecording,
  type MistRecordVariant,
  type MistRequestObservation,
} from "../../../support/mist_raven_recording";
for (const variant of ["last-villager-pass", "last-villager-heal", "last-god"] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Mist actual pending slaughter-side victory with full Tape ${variant}/${locale}`, async () => {
      const samples: MistRequestObservation[] = [];
      const r = await mistRecording(
        variant satisfies MistRecordVariant,
        locale,
        "mist-raven-real-runtime",
        (s) => samples.push(s),
      );
      const heal = variant === "last-villager-heal",
        god = variant === "last-god",
        day = heal ? 4 : 3;
      const cp = r.checkpoints.at(-1)!;
      expect(r.finalized).toBe(true);
      expect(cp.complete).toBe(true);
      expect(cp.cycle).toBe(day);
      expect(cp.snapshot.gameOver).toBe(true);
      expect(cp.snapshot.result?.winner).toBe(Camp.Wolf);
      expect(cp.snapshot.result?.reason).toBe("slaughter_side_completed");
      expect(cp.snapshot.result?.decidedAt).toEqual({
        day,
        phase: Phase.Day,
        checkpoint: "night_settled",
      });
      expect(
        r.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
      ).toEqual(god ? [[2], [4], [1]] : heal ? [[5], [7], [], [8]] : [[5], [7], [8]]);
      expect(r.events.filter((e) => e.type === "game_over")).toHaveLength(1);
      expect(r.events.filter((e) => e.type === "dream_death")).toHaveLength(0);
      expect(r.events.filter((e) => e.type === "raven_unsealed")).toHaveLength(0);
      expect(
        r.decisions.filter(
          (d) =>
            d.actorId === 9 && ["wolf_discussion", "wolf_vote", "raven_knife"].includes(d.stage),
        ),
      ).toHaveLength(0);
      expect(r.decisions.filter((d) => d.stage === "alchemist_snake").map((d) => d.day)).toEqual([
        1, 2, 3,
      ]);
      expect(
        r.events.filter((e) => e.type === "alchemist_snake_chosen").map((e) => e.payload.targetId),
      ).toEqual(heal ? [null, null, 8] : [null, null, null]);
      expect(
        r.checkpoints
          .filter((c) => c.complete && c.cycle > 0)
          .map(
            (c) =>
              (
                c.players.find((p) => p.id === 1)!.privateState.alchemist as {
                  healRemaining: number;
                }
              ).healRemaining,
          ),
      ).toEqual(heal ? [1, 1, 0, 0] : [1, 1, 1]);
      const pending = samples.find((s) => s.day === 3 && s.stage === "alchemist_snake")!;
      expect(pending.gameOver).toBe(false);
      expect(pending.publishedTypes).not.toContain("game_over");
      expect(pending.publishedTypes.filter((t) => t === "night_resolved")).toHaveLength(2);
      expect(pending.aliveIds).toContain(god ? 1 : 8);
      expect(
        pending.aliveIds.filter((id) => (god ? [1, 2, 3, 4] : [5, 6, 7, 8]).includes(id)),
      ).toEqual([god ? 1 : 8]);
      const requests = r.decisions.filter((d) => d.day === 3 && d.stage === "alchemist_snake");
      expect(requests[0]!.request.context.snake_target).toBe(god ? 1 : 8);
      expect(requests[0]!.request.context.snake_candidates).toEqual(god ? [] : [8]);
      if (god) {
        expect(r.events.filter((e) => e.type === "voted_out").map((e) => e.payload.target)).toEqual(
          [3, 6],
        );
        expect(cp.players.filter((p) => p.alive && [1, 2, 3, 4].includes(p.id))).toHaveLength(0);
        expect(cp.players.find((p) => p.id === 5)!.alive).toBe(true);
      } else {
        expect(r.events.filter((e) => e.type === "idiot_revealed").map((e) => e.payload)).toEqual([
          { targetId: 4 },
        ]);
        expect(r.events.some((e) => e.type === "voted_out" && e.payload.target === 4)).toBe(false);
        expect(cp.players.find((p) => p.id === 4)).toMatchObject({
          alive: true,
          vote: { canVote: false, weight: 0 },
        });
        expect(cp.players.filter((p) => p.alive && [5, 6, 7, 8].includes(p.id))).toHaveLength(0);
      }
      expect(r.decisions.some((d) => d.day === day && d.stage === "voting")).toBe(false);
      if (heal) {
        const saved = r.checkpoints.find((c) => c.cycle === 3)!;
        expect(saved.snapshot.gameOver).toBe(false);
        expect(saved.players.find((p) => p.id === 8)!.alive).toBe(true);
        expect(r.events.filter((e) => e.type === "voted_out").map((e) => e.payload.target)).toEqual(
          [6, 12],
        );
        expect(samples.some((s) => s.day === 4 && s.stage === "day_speech")).toBe(false);
      }
    }, 120000);

for (const locale of ["en", "zh-CN"] as const)
  test(`Mist later self-heal is a finalized failure prefix without spending or dying/${locale}`, async () => {
    const samples: MistRequestObservation[] = [];
    const r = await mistRecording("last-god-illegal-self", locale, "mist-raven-real-runtime", (s) =>
      samples.push(s),
    );
    const cp = r.checkpoints.at(-1)!;
    expect(r.finalized).toBe(true);
    expect(r.termination?.reason).toBe("runtime_error");
    expect(r.termination?.errors).toEqual([{ scope: "cycle", name: "Error" }]);
    expect(cp).toMatchObject({
      cycle: 3,
      complete: false,
      failure: { code: "cycle_failed", name: "Error" },
      snapshot: { day: 3, phase: Phase.Day, gameOver: false, result: null },
    });
    expect(cp.players.find((p) => p.id === 1)!.alive).toBe(true);
    expect(cp.players.find((p) => p.id === 1)!.privateState.alchemist).toMatchObject({
      mistRemaining: 0,
      healRemaining: 1,
      healHistory: [
        { day: 1, targetId: null },
        { day: 2, targetId: null },
      ],
    });
    expect(
      r.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
    ).toEqual([[2], [4]]);
    expect(
      r.events.filter((e) => e.type === "alchemist_snake_chosen").map((e) => e.payload.targetId),
    ).toEqual([null, null]);
    expect(r.events.some((e) => e.type === "game_over")).toBe(false);
    expect(r.decisions.at(-1)).toMatchObject({
      actorId: 1,
      day: 3,
      stage: "alchemist_snake",
      outcome: { kind: "action", action: { name: "use_snake", args: { target_id: 1 } } },
    });
    expect(r.decisions.at(-1)!.request.context.snake_candidates).toEqual([]);
    expect(samples.find((s) => s.day === 3 && s.stage === "alchemist_snake")!.aliveIds).toContain(
      1,
    );
  }, 120000);
