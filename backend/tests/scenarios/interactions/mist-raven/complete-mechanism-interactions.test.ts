/**
 * Interaction scenarios verify complete Mist/Raven recordings preserve declared rescue, dream, knowledge and death-chain interactions.
 * Input: Original recording variants, locale matrix and literal deaths, Snake/extra targets, knowledge and dream-reason tables.
 * Output and oracle: Explicit event/checkpoint/result assertions retain actual causal replay; no expected table or archive fixture is regenerated.
 */
import { expect, test } from "bun:test";
import { Camp } from "../../../../src/domain";
import { mistRecording } from "../../../support/features/mist-raven/drivers/recording";
import { type MistRecordVariant } from "../../../support/features/mist-raven/builders/board";
const cases: Array<{
  variant: MistRecordVariant;
  deaths: number[][];
  snake: Array<number | null>;
  extra: Array<number | null>;
  known: number[][];
  dreamReasons: Array<[number, number, string]>;
}> = [
  {
    variant: "pure-saved-dreamer",
    deaths: [[11], [], [6]],
    snake: [null, 3],
    extra: [null, null],
    known: [[10]],
    dreamReasons: [],
  },
  {
    variant: "consecutive-heal",
    deaths: [[11], [5], [6, 3, 7]],
    snake: [null, 5],
    extra: [null, 3],
    known: [[10]],
    dreamReasons: [
      [2, 5, "consecutive"],
      [3, 7, "linked"],
    ],
  },
  {
    variant: "ordinary-double",
    deaths: [[11], [6], [8]],
    snake: [null, 6],
    extra: [6],
    known: [[10]],
    dreamReasons: [],
  },
  {
    variant: "mixed-order",
    deaths: [[11], [3, 5], [6]],
    snake: [null, 3],
    extra: [3],
    known: [[10]],
    dreamReasons: [
      [2, 5, "consecutive"],
      [2, 5, "linked"],
    ],
  },
  {
    variant: "self-heal",
    deaths: [[], [11], [6, 3, 7]],
    snake: [1],
    extra: [3],
    known: [[]],
    dreamReasons: [[3, 7, "linked"]],
  },
];
for (const c of cases)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Mist complete manual interaction with finalized exact Tape ${c.variant}/${locale}`, async () => {
      const r = await mistRecording(c.variant, locale);
      expect(r.finalized).toBe(true);
      expect(r.checkpoints.at(-1)!.snapshot.result?.winner).toBe(Camp.Good);
      expect(r.checkpoints.at(-1)!.snapshot.result?.reason).toBe("all_wolves_eliminated");
      expect(
        r.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
      ).toEqual(c.deaths);
      expect(
        r.events.filter((e) => e.type === "alchemist_snake_chosen").map((e) => e.payload.targetId),
      ).toEqual(c.snake);
      expect(
        r.events.filter((e) => e.type === "raven_knife_chosen").map((e) => e.payload.targetId),
      ).toEqual(c.extra);
      expect(
        r.events.filter((e) => e.type === "raven_unsealed").map((e) => e.payload.knownTeammateIds),
      ).toEqual(c.known);
      expect(
        r.events
          .filter((e) => e.type === "dream_death")
          .map((e) => [e.payload.day, e.payload.targetId, e.payload.reason]),
      ).toEqual(c.dreamReasons);
      const damage = r.operations
        .filter((o) => o.scope === "resolution" && o.op === "night_damage_resolved")
        .map((o) => o.output as { deaths: number[]; death_sources: Record<string, string[]> });
      expect(damage.map((d) => d.deaths)).toEqual(c.deaths);
      expect(r.decisions.filter((d) => d.stage === "alchemist_snake").map((d) => d.day)).toEqual(
        c.variant === "self-heal" ? [1] : [1, 2],
      );
      expect(r.decisions.filter((d) => d.stage === "raven_knife").map((d) => d.day)).toEqual(
        c.variant === "self-heal"
          ? [3]
          : ["pure-saved-dreamer", "consecutive-heal"].includes(c.variant)
            ? [2, 3]
            : [2],
      );
      const complete = r.checkpoints.filter((cp) => cp.cycle > 0 && cp.complete);
      expect(complete).toHaveLength(3);
      expect(
        complete.map(
          (cp) =>
            (
              cp.players.find((p) => p.id === 1)!.privateState.alchemist as {
                mistRemaining: number;
              }
            ).mistRemaining,
        ),
      ).toEqual([0, 0, 0]);
      expect(
        complete.map(
          (cp) =>
            (
              cp.players.find((p) => p.id === 1)!.privateState.alchemist as {
                healRemaining: number;
              }
            ).healRemaining,
        ),
      ).toEqual(c.variant === "self-heal" ? [0, 0, 0] : [1, 0, 0]);
      expect(
        complete.map(
          (cp) =>
            (
              cp.players.find((p) => p.id === 9)!.privateState.ravenClaw as {
                extraRemaining: number;
              }
            ).extraRemaining,
        ),
      ).toEqual(
        c.variant === "pure-saved-dreamer"
          ? [1, 1, 1]
          : ["consecutive-heal", "self-heal"].includes(c.variant)
            ? [1, 1, 0]
            : [1, 0, 0],
      );
      const publications = r.events
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.type === "night_resolved");
      for (const { e, i } of r.events
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.type === "alchemist_snake_chosen"))
        expect(i).toBeLessThan(publications[Number(e.payload.day) - 1]!.i);
      if (c.variant === "pure-saved-dreamer") expect(damage[1]!.death_sources).toEqual({});
      if (c.variant === "consecutive-heal")
        expect(damage[1]!.death_sources).toEqual({ 5: ["dream"] });
      if (c.variant === "ordinary-double")
        expect(damage[1]!.death_sources).toEqual({ 6: ["raven_claw_knife"] });
      if (c.variant === "mixed-order")
        expect(damage[1]!.death_sources).toEqual({ 3: ["raven_claw_knife"], 5: ["dream"] });
      if (c.variant === "self-heal") {
        expect(damage[0]!.death_sources).toEqual({});
        expect(r.events.find((e) => e.type === "raven_unsealed")!.payload.day).toBe(3);
      }
    }, 120000);
