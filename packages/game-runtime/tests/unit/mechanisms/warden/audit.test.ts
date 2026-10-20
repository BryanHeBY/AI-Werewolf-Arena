/** 独立Warden账本验算的手写纯记录；本单元不冒充完整Tape格式，完整parse/replay由真实protocol另证。 */
import { expect, test } from "bun:test";
import { wardenTwelveConfig } from "../../../../src/rulesets/presets/warden-twelve";
import { validateWardenRecord } from "../../../../src/recording/verification/warden/validate";
import type { ReproductionRecord } from "../../../../src/recording/reproduction/format";
const policy = "awa_melbourne_warden_v1";
function fixture(): ReproductionRecord {
  const roles = [
    "warden",
    "wolf",
    "wolf",
    "wolf",
    "villager",
    "villager",
    "villager",
    "villager",
    "seer",
    "witch",
    "hunter",
    "dreamer",
  ];
  const events: any[] = [
    { timestamp: 1, type: "phase_changed", payload: { day: 2, phase: "night" } },
    {
      timestamp: 2,
      type: "warden_pair_chosen",
      payload: { policy, day: 2, actorId: 1, pair: [9, 10] },
      audience: [1],
    },
    {
      timestamp: 3,
      type: "warden_partner_notified",
      payload: { policy, day: 2, actorId: 9, partnerId: 10 },
      audience: [9],
    },
    {
      timestamp: 4,
      type: "warden_partner_notified",
      payload: { policy, day: 2, actorId: 10, partnerId: 9 },
      audience: [10],
    },
    {
      timestamp: 5,
      type: "warden_decision",
      payload: { policy, day: 2, actorId: 9, choice: "betray" },
      audience: [9],
    },
    {
      timestamp: 6,
      type: "warden_decision",
      payload: { policy, day: 2, actorId: 10, choice: "betray" },
      audience: [10],
    },
    {
      timestamp: 7,
      type: "warden_resolved",
      payload: {
        policy,
        day: 2,
        actorId: 1,
        pair: [9, 10],
        choices: ["betray", "betray"],
        outcome: "force",
        dealIds: [],
      },
      audience: [],
    },
    { timestamp: 8, type: "phase_changed", payload: { day: 2, phase: "day" } },
    { timestamp: 9, type: "night_resolved", payload: { deaths: [] } },
  ];
  const decision = (
    id: number,
    tool: string,
    args: unknown,
    cursor: number,
    order: number,
    extra: object,
  ) => ({
    actorId: id,
    day: 2,
    stage: tool,
    turn: 1,
    openedAtEventCount: cursor,
    openedAfterSettlement: order === 1 ? 0 : 1,
    settleOrder: order,
    request: {
      actorId: id,
      phase: "night",
      allowedTools: [tool],
      context: {
        day: 2,
        stage: tool,
        visible_events: events
          .slice(0, cursor)
          .filter((e) => e.type.startsWith("warden_") && e.audience?.includes(id))
          .map((e, i) => ({ seq: i + 1, type: e.type, payload: structuredClone(e.payload) })),
        turn_constraints: {},
        action_failure_policy: "error",
        allow_fallback: false,
        ...extra,
      },
    },
    outcome: { kind: "action", action: { name: tool, args } },
  });
  return {
    finalized: true,
    metadata: {
      normalizedBoard: structuredClone(wardenTwelveConfig),
      players: roles.map((role, i) => ({ id: i + 1, role, camp: i < 4 ? "wolf" : "good" })),
    },
    decisions: [
      decision(1, "warden_pair", { target_ids: [9, 10] }, 1, 1, {
        warden_candidates: roles.map((_, i) => i + 1),
      }),
      decision(9, "warden_decide", { choice: "betray" }, 4, 2, { warden_partner_id: 10 }),
      decision(10, "warden_decide", { choice: "betray" }, 4, 3, { warden_partner_id: 9 }),
    ],
    events,
    operations: [
      {
        scope: "resolution",
        op: "night_damage_resolved",
        event_count: 7,
        phase: "night",
        status: "ok",
        output: { deaths: [], death_sources: {} },
      },
    ],
    checkpoints: [
      {
        eventCount: events.length,
        decisionCount: 3,
        settlementCount: 3,
        complete: true,
        players: roles.map((role, i) => ({
          id: i + 1,
          role,
          camp: i < 4 ? "wolf" : "good",
          alive: true,
          privateState: i
            ? {}
            : {
                warden: {
                  policy,
                  forcePolicy: "awa_warden_partner_native_v1",
                  history: [
                    {
                      day: 2,
                      pair: [9, 10],
                      decisions: [
                        { playerId: 9, choice: "betray" },
                        { playerId: 10, choice: "betray" },
                      ],
                      resolved: true,
                    },
                  ],
                },
              },
        })),
      },
    ],
  } as unknown as ReproductionRecord;
}
test("手写普通双背叛真实受众/receipt/CP账本闭合", () =>
  expect(() => validateWardenRecord(fixture())).not.toThrow());
for (const mutation of [
  "god-leak",
  "pair-audience",
  "decision-choice",
  "outcome",
  "partner",
  "foreign-feed",
  "missing-feed",
  "history-forgery",
  "paid-error",
  "fake-force",
] as const)
  test(`拒绝独立篡改 ${mutation}`, () => {
    const r = fixture();
    switch (mutation) {
      case "god-leak":
        r.events[6]!.audience = [9];
        break;
      case "pair-audience":
        r.events[1]!.audience = [2];
        break;
      case "decision-choice":
        r.events[4]!.payload.choice = "trade";
        break;
      case "outcome":
        r.events[6]!.payload.outcome = "protect";
        break;
      case "partner":
        r.decisions[1]!.request.context.warden_partner_id = 1;
        break;
      case "foreign-feed":
        r.decisions[1]!.request.context.visible_events.push({
          seq: 2,
          type: "warden_decision",
          payload: { policy, day: 2, actorId: 10, choice: "betray" },
        });
        break;
      case "missing-feed":
        r.decisions[1]!.request.context.visible_events = [];
        break;
      case "history-forgery":
        (r.checkpoints[0]!.players[0]!.privateState.warden as { history: unknown[] }).history = [];
        break;
      case "paid-error":
        r.decisions[1]!.outcome = { kind: "error", code: "decision_failed", name: "Error" };
        break;
      case "fake-force":
        r.decisions[0]!.request.context.warden_forced_target = 5;
        break;
    }
    expect(() => validateWardenRecord(r)).toThrow("reproduction_warden_invalid");
  });
test("一方missing保合法pair和另一receipt，不把失败升级为betray", () => {
  const r = fixture();
  r.events.splice(5, 4);
  r.operations = [];
  r.decisions[2]!.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  r.decisions[2]!.returnedCandidate = null;
  r.checkpoints[0]!.complete = false;
  r.checkpoints[0]!.eventCount = r.events.length;
  const h = (
    r.checkpoints[0]!.players[0]!.privateState.warden as {
      history: Array<{ decisions: unknown[]; resolved: boolean }>;
    }
  ).history[0]!;
  h.decisions = [{ playerId: 9, choice: "betray" }];
  h.resolved = false;
  expect(() => validateWardenRecord(r)).not.toThrow();
  h.decisions.push({ playerId: 10, choice: "trade" });
  h.resolved = true;
  expect(() => validateWardenRecord(r)).toThrow();
});

test("秘密decide不能携主持者pair候选或其他Warden字段补漏知情", () => {
  const r = fixture();
  r.decisions[1]!.request.context.warden_candidates = [1, 2, 3];
  expect(() => validateWardenRecord(r)).toThrow();
});
