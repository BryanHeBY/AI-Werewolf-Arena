/**
 * Owns test oracle support: Independent Radiant/Eclipse terminal and causal-event literal assertions over completed transport runs.
 * Inputs are actual wire messages, request prefixes, snapshots or a former
 * local endpoint plus explicit expectations; outputs are the original assertions
 * and rejection diagnostics. Unit/integration/scenario tests retain their
 * independent literal markers and recorded prefixes as the oracle. No expected
 * result is regenerated from production role, observation or board algorithms.
 */
import { expect } from "bun:test";
import type { ReproductionRecord } from "../../../../../src/recording/reproduction";
export function assertRadiantTransportGolden(record: ReproductionRecord, name: string) {
  const ability = (cycle: number, actor: number, id: string) => {
    const player = record.checkpoints
      .find((c) => c.cycle === cycle)!
      .players.find((p) => p.id === actor)!;
    return (player.privateState.abilities as Record<string, { state: Record<string, unknown> }>)[
      id
    ]!;
  };
  const stock = (cycle: number, actor: number, id: string) => {
    const state = ability(cycle, actor, id).state;
    return [state.heal, state.poison];
  };
  if (name === "zero-one-then-empty" || name === "one-zero-borrow-heal") {
    const expected =
      name === "zero-one-then-empty"
        ? [
            [0, 1],
            [0, 1],
            [0, 0],
            [0, 0],
          ]
        : [
            [1, 0],
            [1, 0],
            [1, 0],
          ];
    expect(expected.map((_, i) => stock(i + 1, 7, "native:potion"))).toEqual(expected);
    expect(stock(2, 10, "copy:eclipse:night:2")).toEqual([0, 0]);
    const request = record.decisions.find(
      (d) => d.day === 2 && d.actorId === 10 && d.stage === "witch",
    )!;
    if (name === "zero-one-then-empty") {
      expect(Object.hasOwn(request.request.context, "wolf_target")).toBe(false);
      expect(record.decisions.filter((d) => d.day === 4 && d.stage === "witch")).toEqual([]);
      expect(ability(4, 10, "copy:eclipse:night:4")).toMatchObject({
        uses: 0,
        lastUsedDay: null,
        disabled: true,
      });
      expect(stock(4, 10, "copy:eclipse:night:4")).toEqual([0, 0]);
    } else expect(request.request.context.wolf_target).toBe(11);
  }
  if (name === "last-villager-saved-then-double-cause") {
    for (let day = 1; day <= 4; day++) expect(stock(day, 7, "native:potion")).toEqual([1, 1]);
    expect(stock(2, 10, "copy:eclipse:night:2")).toEqual([0, 1]);
    expect(stock(4, 10, "copy:eclipse:night:4")).toEqual([1, 0]);
  }
  if (name === "last-god-restored-dream-gap") {
    expect(ability(2, 4, "native:dream").state).toMatchObject({
      lastTarget: 1,
      lastDay: 1,
      history: [{ day: 1, targetId: 1 }],
    });
    expect(ability(3, 4, "native:dream").state).toMatchObject({
      lastTarget: 1,
      lastDay: 3,
      history: [
        { day: 1, targetId: 1 },
        { day: 3, targetId: 1 },
      ],
    });
    expect(ability(2, 10, "copy:eclipse:night:2").state).toMatchObject({
      lastTarget: 1,
      lastDay: 2,
      history: [{ day: 2, targetId: 1 }],
    });
  }
  if (name === "independent-stock-card16-card17") {
    for (const day of [2, 3])
      expect(ability(day, 9, "native:shelter").state).toEqual({
        policy: "awa_radiant_eclipse_v1",
        lastTarget: 11,
        lastDay: 2,
      });
    expect(ability(3, 10, "copy:eclipse:night:3").state).toEqual({
      policy: "awa_radiant_eclipse_v1",
      lastTarget: 4,
      lastDay: 3,
    });
    expect(ability(4, 9, "native:shelter").state).toEqual({
      policy: "awa_radiant_eclipse_v1",
      lastTarget: 4,
      lastDay: 4,
    });
    expect([1, 2, 3, 4].map((day) => stock(day, 7, "native:potion"))).toEqual([
      [1, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ]);
  }
  if (name === "borrowed-dream-death-badge-words") {
    expect(record.events.filter((e) => e.type === "dream_death").map((e) => e.payload)).toEqual([
      { actorId: 10, targetId: 5, day: 2, reason: "linked", abilityId: "copy:eclipse:night:2" },
    ]);
    expect(
      record.events.filter((e) => e.type === "sheriff_badge_transferred").map((e) => e.payload),
    ).toEqual([{ fromId: 10, toId: 9, reason: "night_death" }]);
  }
}
