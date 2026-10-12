import { expect, test } from "bun:test";
import { radiantTransportScenario } from "../support/radiant_eclipse_transport_scenarios";
import { assertTransportPrompt } from "../support/transport_prompt_oracle";
import {
  assertRadiantWireEvents,
  assertRadiantTransportWire,
} from "../support/features/radiant-eclipse/oracles/wire";
import { radiantRecording } from "../support/radiant_eclipse_recording";
test("transport mapping matches independent FNV/Mulberry/Fisher literal golden", async () => {
  const s = await radiantTransportScenario();
  expect(s.roles.map(String)).toEqual([
    "villager",
    "wolf",
    "wolf",
    "dreamer",
    "villager",
    "villager",
    "witch",
    "seer",
    "radiant_count",
    "eclipse_maid",
    "wolf",
    "villager",
  ]);
  expect(Object.fromEntries(s.mapping)).toEqual({
    1: 10,
    2: 9,
    3: 8,
    4: 7,
    5: 4,
    6: 1,
    7: 5,
    8: 6,
    9: 12,
    10: 2,
    11: 3,
    12: 11,
  });
  expect(s.ordinary).toEqual([2, 3, 11]);
});
test("actual serialized wire must be a current independently validated request prefix", async () => {
  const record = await radiantRecording({ planName: "independent-stock-card16-card17" });
  const decisions = record.decisions.filter((d) => d.actorId === 1),
    ordinal = decisions.findIndex((d) => d.day === 2 && d.stage === "witch") + 1;
  const visible = decisions[ordinal - 1]!.request.context.visible_events;
  const tuples = visible.map(
    (e) => [e.seq, e.type, e.payload] as [number, string, Record<string, unknown>],
  );
  expect(() => assertRadiantWireEvents(record, 1, ordinal, tuples)).not.toThrow();
  for (const change of [
    (t: typeof tuples) => {
      t[0]![0] = 0;
    },
    (t: typeof tuples) => {
      t[0]![1] = "game_over";
    },
    (t: typeof tuples) => {
      t.find((e) => e[1] === "eclipse_swallowed")![2].day = 3;
    },
    (t: typeof tuples) => {
      t.find((e) => e[1] === "eclipse_swallowed")![2].roleId = "seer";
    },
    (t: typeof tuples) => {
      t.find((e) => e[1] === "ability_changed")![2].sourceHistory = "SOURCE_HISTORY_PRIVATE";
    },
    (t: typeof tuples) => {
      t.push(t[0]!);
    },
    (t: typeof tuples) => {
      t.push([t.length + 1, "seer_checked", { actorId: 1, targetId: 2, isWerewolf: false }]);
    },
  ]) {
    const changed = structuredClone(tuples);
    change(changed);
    expect(() => assertRadiantWireEvents(record, 1, ordinal, changed)).toThrow();
  }
});
test("borrow binding and current inventory cannot be replaced by historical substrings", async () => {
  const s = await radiantTransportScenario(),
    turn = s.turns.get(10)!.find((t) => t.day === 2 && t.stage === "witch")!;
  const plan = { actorId: 10, locale: "en" as const, role: s.roles[9]!, turns: [turn] };
  const bound =
    "This turn executes only the engine-bound ability copy:eclipse:night:2; do not add an ability ID to tool arguments.";
  const summary = `Ability copy:eclipse:night:2: Potion use; status=Effective; uses remaining=Unlimited; your resources and records=${JSON.stringify(turn.radiantBorrow!.state)}`;
  const prompt = `[Action prompt] Player 10, Current game day: 2. stage: Witch action; Current turn ID: t2\n${summary} ${bound} Wolf teammate identities revealed for this turn, excluding yourself: 2, 3, 11.`;
  expect(() => assertTransportPrompt(plan, turn, prompt)).not.toThrow();
  expect(() =>
    assertTransportPrompt(
      plan,
      turn,
      prompt.replace(bound, bound.replace("copy:eclipse:night:2", "native:potion")),
    ),
  ).toThrow();
  expect(() =>
    assertTransportPrompt(
      plan,
      turn,
      prompt.replace('"heal":1', '"heal":0') + '\nOld stock: "heal":1',
    ),
  ).toThrow();
  expect(() =>
    assertTransportPrompt(
      plan,
      turn,
      prompt.replace('"heal":1', '"sourceHistory":"SOURCE_HISTORY_PRIVATE","heal":1'),
    ),
  ).toThrow();
});
test("complete SDK history and ACP prompts reject donor private text outside event tuples", async () => {
  const record = await radiantRecording({ planName: "independent-stock-card16-card17" });
  const decisions = record.decisions.filter((d) => d.actorId === 1),
    ordinal = decisions.findIndex((d) => d.day === 2 && d.stage === "witch") + 1;
  const events = decisions[ordinal - 1]!.request.context.visible_events.map((e) => [
    e.seq,
    e.type,
    e.payload,
  ]);
  for (const kind of ["sdk", "acp"] as const) {
    const wire = (extra: string) => ({
      record,
      sdkWireMessages:
        kind === "sdk"
          ? [
              {
                actor: 1,
                ordinal,
                messages: [
                  ...events.map((event) => ({ role: "user", content: JSON.stringify({ event }) })),
                  { role: "user", content: extra },
                ],
              },
            ]
          : [],
      acpTraces:
        kind === "acp"
          ? [
              {
                actor: 1,
                trace: {
                  prompts: [`Current turn ID: t1\n${JSON.stringify({ events })}\n${extra}`],
                  arrivals: [{ actorOrdinal: ordinal }],
                },
              },
            ]
          : [],
    });
    expect(() => assertRadiantTransportWire(wire(""))).not.toThrow();
    expect(() =>
      assertRadiantTransportWire(
        wire('Original owner history: [{"canary":"SOURCE_HISTORY_PRIVATE","targetId":8}]'),
      ),
    ).toThrow();
    expect(() => assertRadiantTransportWire(wire("SOURCE_HISTORY_PRIVATE_ACTOR_7"))).toThrow();
  }
});
