/**
 * Unit tests for Mist/Raven transport message-contract assertions. Inputs are
 * literal event tuples, bilingual stage prompts and per-actor wire state; output
 * is the original acceptance/rejection and stock/sequence assertions. Handwritten
 * unseal, target and ordinal anchors are the oracle, with one seeded scenario
 * builder supplying plan identities. No SDK/ACP process or game is executed.
 */
import { mistTransportScenario } from "../support/mist_raven_transport_scenarios";
import { expect, test } from "bun:test";
import { Role } from "../../src/core";
import { assertTransportEvents, assertTransportPrompt } from "../support/transport_prompt_oracle";
import type { MistWireState } from "../support/features/mist-raven/oracles/transport";
const unseal = { actorId: 9, day: 2, awakened: true, knownTeammateIds: [10] },
  expected = { unseal: { day: 2, knownTeammateIds: [10] } };
for (const [type, payload] of [
  ["alchemist_mist_chosen", { actorId: 1, day: 1, targetIds: [1, 5, 6] }],
  ["alchemist_mist_skipped", { actorId: 1, day: 2, reason: "spent" }],
  ["alchemist_snake_chosen", { actorId: 1, day: 1, targetId: 5 }],
  ["raven_unsealed", unseal],
  ["raven_knife_chosen", { actorId: 9, day: 2, targetId: 3 }],
  ["raven_knife_skipped", { actorId: 9, day: 1, reason: "sealed" }],
  ["mist_knife_drawn", { day: 1, candidates: [1, 5, 6], targetId: 5 }],
] as Array<[string, Record<string, unknown>]>)
  test("wire rejects ordinary player receiving " + type, () => {
    expect(() =>
      assertTransportEvents("villager", [[1, type, payload]], 4, undefined, { currentDay: 2 }),
    ).toThrow(
      type === "mist_knife_drawn"
        ? "fixture_mist_draw_exposed"
        : "fixture_mist_private_fact_exposed",
    );
  });
for (const [stage, labels] of [
  ["alchemist_mist", ["未明之雾", "Alchemist Mist"]],
  ["alchemist_snake", ["法老之蛇救治", "Snake healing"]],
  ["raven_knife", ["狼鸦额外刀", "Raven extra knife"]],
] as const)
  test("wire accepts both localized stages/" + stage, () => {
    for (const locale of ["zh-CN", "en"] as const) {
      const prompt =
        locale === "en"
          ? `[Action prompt] Player 1, Current game day: 1. stage: ${labels[1]}; Current turn ID: t1`
          : `[行动提示] 1号玩家 当前日次：第1天。 子阶段是${labels[0]}，当前回合 ID：t1`;
      expect(
        assertTransportPrompt(
          { actorId: 1, role: Role.Alchemist, locale, turns: [] },
          { day: 1, stage, action: null },
          prompt,
        ),
      ).toBe("t1");
    }
  });
test("Raven gets only pack sequences after literal unseal, including subsequent ACP delta", () => {
  const state: MistWireState = { currentDay: 2 };
  assertTransportEvents("raven_claw_wolf", [[5, "raven_unsealed", unseal]], 9, expected, state);
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[6, "wolf_tactical_order", { order: [9, 10] }]],
      9,
      expected,
      state,
    ),
  ).not.toThrow();
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[3, "wolf_discussion", { actorId: 11, text: "past", endChat: false, round: 1 }]],
      9,
      expected,
      state,
    ),
  ).toThrow();
  expect(() =>
    assertTransportEvents("raven_claw_wolf", [[7, "raven_unsealed", unseal]], 9, expected, state),
  ).toThrow();
  expect(() =>
    assertTransportEvents("raven_claw_wolf", [[5, "raven_unsealed", unseal]], 9, expected, state),
  ).not.toThrow();
});
test("a literal future unseal does not authorize the current sealed night's history", () => {
  const state: MistWireState = { currentDay: 1 };
  expect(() =>
    assertTransportEvents("raven_claw_wolf", [[5, "raven_unsealed", unseal]], 9, expected, state),
  ).toThrow();
  expect(state.unsealSeq).toBeUndefined();
});
test("a sealed Raven gets neither ordinary pack nor a random draw", () => {
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[1, "wolf_tactical_order", { order: [10, 11, 12] }]],
      9,
    ),
  ).toThrow();
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[2, "mist_knife_drawn", { day: 1, candidates: [10, 11, 12], targetId: 11 }]],
      9,
      { draw: { day: 1, candidates: [10, 11, 12], targetId: 11 } },
    ),
  ).toThrow();
});
test("private fact role, actor, shape and literal unseal knowledge are independent", () => {
  expect(() =>
    assertTransportEvents(
      "alchemist",
      [[1, "alchemist_mist_chosen", { actorId: 2, day: 1, targetIds: [1, 5, 6] }]],
      1,
      undefined,
      { currentDay: 2 },
    ),
  ).toThrow("fixture_mist_private_fact_exposed");
  expect(() =>
    assertTransportEvents(
      "alchemist",
      [[1, "alchemist_snake_chosen", { actorId: 1, day: 2, targetId: 1 }]],
      1,
      undefined,
      { currentDay: 2 },
    ),
  ).toThrow("fixture_mist_fact_invalid");
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[2, "raven_unsealed", { ...unseal, knownTeammateIds: [11] }]],
      9,
      expected,
      { currentDay: 2 },
    ),
  ).toThrow("fixture_raven_unseal_mismatch");
});
test("Raven extra choices require unseal and can consume exactly once", () => {
  const chosen = { actorId: 9, day: 2, targetId: 3 };
  const state: MistWireState = { currentDay: 2 };
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[2, "raven_knife_chosen", chosen]],
      9,
      expected,
      state,
    ),
  ).toThrow();
  assertTransportEvents("raven_claw_wolf", [[5, "raven_unsealed", unseal]], 9, expected, state);
  assertTransportEvents(
    "raven_claw_wolf",
    [[6, "raven_knife_chosen", { ...chosen, targetId: null }]],
    9,
    expected,
    state,
  );
  expect(state.extraUsedSeq).toBeUndefined();
  state.currentDay = 3;
  chosen.day = 3;
  assertTransportEvents("raven_claw_wolf", [[7, "raven_knife_chosen", chosen]], 9, expected, state);
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[8, "raven_knife_chosen", chosen]],
      9,
      expected,
      state,
    ),
  ).toThrow();
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[7, "raven_knife_chosen", chosen]],
      9,
      expected,
      state,
    ),
  ).not.toThrow();
});
test("an authorized draw compares semantic fields and is accepted only for its literal audience", () => {
  const draw = { day: 1, candidates: [10, 11, 12], targetId: 11 };
  expect(() =>
    assertTransportEvents(
      "wolf",
      [[5, "mist_knife_drawn", { targetId: 11, candidates: [10, 11, 12], day: 1 }]],
      10,
      { draw },
      { currentDay: 1 },
    ),
  ).not.toThrow();
  expect(() =>
    assertTransportEvents(
      "wolf",
      [[5, "mist_knife_drawn", { ...draw, targetId: 12 }]],
      10,
      { draw },
      { currentDay: 1 },
    ),
  ).toThrow();
});

test("wire compares literal private targets and their original settlement boundary", () => {
  const payload = { actorId: 1, day: 1, targetIds: [1, 5, 6] },
    proof = { choices: [{ type: "alchemist_mist_chosen", payload, afterOrdinal: 1 }] };
  const state: MistWireState = { currentDay: 1, currentRequestOrdinal: 1 };
  expect(() =>
    assertTransportEvents("alchemist", [[5, "alchemist_mist_chosen", payload]], 1, proof, state),
  ).toThrow("fixture_mist_unsettled_fact_exposed");
  expect(state.seenFacts).toBeUndefined();
  state.currentRequestOrdinal = 2;
  expect(() =>
    assertTransportEvents("alchemist", [[5, "alchemist_mist_chosen", payload]], 1, proof, state),
  ).not.toThrow();
  expect(() =>
    assertTransportEvents(
      "alchemist",
      [[6, "alchemist_mist_chosen", { ...payload, targetIds: [2, 3, 4] }]],
      1,
      proof,
      { currentDay: 1, currentRequestOrdinal: 2 },
    ),
  ).toThrow("fixture_mist_choice_mismatch");
  expect(() =>
    assertTransportEvents(
      "alchemist",
      [[5, "alchemist_mist_chosen", { ...payload, targetIds: [2, 3, 4] }]],
      1,
      proof,
      state,
    ),
  ).toThrow("fixture_mist_sequence_changed");
  expect(() =>
    assertTransportEvents("alchemist", [[6, "alchemist_mist_chosen", payload]], 1, proof, state),
  ).toThrow("fixture_mist_sequence_changed");
});
test("Raven cannot receive a re-numbered draw from its sealed earlier night", () => {
  const state: MistWireState = { currentDay: 2 };
  assertTransportEvents("raven_claw_wolf", [[5, "raven_unsealed", unseal]], 9, expected, state);
  const draw = { day: 1, candidates: [10, 11, 12], targetId: 11 };
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[6, "mist_knife_drawn", draw]],
      9,
      { ...expected, draw },
      state,
    ),
  ).toThrow("fixture_raven_historical_pack_exposed");
});
test("new old sequences, fractional sequences and false spent cannot alter Raven stock", () => {
  const state: MistWireState = { currentDay: 3 };
  assertTransportEvents("raven_claw_wolf", [[5, "raven_unsealed", unseal]], 9, expected, state);
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[6, "raven_knife_skipped", { actorId: 9, day: 2, reason: "spent" }]],
      9,
      expected,
      state,
    ),
  ).toThrow("fixture_raven_extra_unavailable");
  const chosen = { actorId: 9, day: 3, targetId: 3 };
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[8.5, "raven_knife_chosen", chosen]],
      9,
      expected,
      state,
    ),
  ).toThrow("fixture_mist_fact_invalid");
  assertTransportEvents("raven_claw_wolf", [[8, "raven_knife_chosen", chosen]], 9, expected, state);
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[7, "raven_knife_chosen", { ...chosen, day: 2, targetId: 4 }]],
      9,
      expected,
      state,
    ),
  ).toThrow("fixture_raven_extra_unavailable");
  expect(state.extraUsedSeq).toBe(8);
});

test("Raven pack facts do not add unknown dead wolves or resequence earlier known chat", () => {
  const state: MistWireState = { currentDay: 2 };
  const proof = {
    ...expected,
    packFacts: [
      {
        type: "wolf_discussion_ended",
        sourceDay: 2,
        payload: { actorId: 10, reason: "End day 2", round: 1 },
      },
    ],
  };
  assertTransportEvents("raven_claw_wolf", [[5, "raven_unsealed", unseal]], 9, proof, state);
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[6, "wolf_discussion", { actorId: 11, text: "past", endChat: false, round: 1 }]],
      9,
      proof,
      state,
    ),
  ).toThrow("fixture_raven_unknown_pack_member");
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[6, "wolf_tactical_order", { order: [9, 10, 11] }]],
      9,
      proof,
      state,
    ),
  ).toThrow("fixture_raven_unknown_pack_member");
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[6, "wolf_discussion_ended", { actorId: 10, reason: "End day 1", round: 1 }]],
      9,
      proof,
      state,
    ),
  ).toThrow("fixture_raven_pack_fact_mismatch");
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[6, "wolf_discussion_ended", { actorId: 10, reason: "End day 2", round: 1 }]],
      9,
      proof,
      state,
    ),
  ).not.toThrow();
});

test("literal spent notification is released after the current night's ordinary vote", async () => {
  const scenario = await mistTransportScenario(),
    actor = scenario.raven,
    proof = scenario.promptAssertions!(actor, "en").mistWire!;
  const plan = scenario.turns.get(actor)!;
  const ordinal = (stage: string) => plan.findIndex((t) => t.day === 3 && t.stage === stage) + 1;
  const state: MistWireState = { currentDay: 3, currentRequestOrdinal: ordinal("wolf_discussion") };
  assertTransportEvents(
    "raven_claw_wolf",
    [
      [
        5,
        "raven_unsealed",
        { actorId: actor, day: 2, awakened: true, knownTeammateIds: scenario.known },
      ],
    ],
    actor,
    proof,
    state,
  );
  assertTransportEvents(
    "raven_claw_wolf",
    [[6, "raven_knife_chosen", { actorId: actor, day: 2, targetId: scenario.dreamer }]],
    actor,
    proof,
    state,
  );
  const skipped = { actorId: actor, day: 3, reason: "spent" };
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[7, "raven_knife_skipped", skipped]],
      actor,
      proof,
      state,
    ),
  ).toThrow("fixture_mist_unsettled_fact_exposed");
  state.currentRequestOrdinal = ordinal("wolf_vote") + 1;
  expect(() =>
    assertTransportEvents(
      "raven_claw_wolf",
      [[7, "raven_knife_skipped", skipped]],
      actor,
      proof,
      state,
    ),
  ).not.toThrow();
});
