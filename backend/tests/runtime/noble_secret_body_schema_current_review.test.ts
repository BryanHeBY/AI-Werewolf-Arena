/**
 * Wire-oracle unit tests verify current Noble status and static schema reject extra inventory fields.
 * Input: Handwritten valid SDK/ACP status/schema/prefix fixtures and exact malformed extensions.
 * Output and independent oracle: Literal schema equality and current-feed rejection codes, independent of spelling blacklist or runtime schema builder.
 * This boundary never substitutes an unrelated full game or production reducer for its explicit oracle.
 */
import { expect, test } from "bun:test";
import {
  assertNobleTransportWire,
  type NobleWireRun,
} from "../support/features/noble-secret-body/oracles/wire";

// Literal owner notice and initial state: this unit tests the actual-wire checker,
// not the record parser. No World/projector is consulted to derive the expected input.
const known = {
  protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
  lastNotifiedNight: 1,
  lastChoice: null,
  resource: "intact",
  publicRevealDay: null,
  awaitingNightReport: false,
};
const schema = {
  protocol_version: "1",
  tools: {
    get_game_schema: "{}; query the fixed tool protocol without returning game state.",
    submit_action:
      "{ turn_id, action, arguments }; select one validated action. accepted=true, applied=false means it awaits final engine validation; result events determine its effect.",
    report_bug:
      "{ turn_id, category, severity, message }; report a confirmed engine contradiction.",
  },
};
function input(kind: "acp" | "sdk" = "acp"): NobleWireRun {
  const { awaitingNightReport, ...noticeKnown } = known;
  const fact = {
    seq: 1,
    type: "secret_body_night_notified",
    payload: { policy: "awa_noble_secret_body_v1", actorId: 5, day: 1, ...noticeKnown },
  };
  const current = `[Action prompt] Player 5,\nCurrent turn ID: t1\nYour last announced body state (night consumption is announced next night): ${JSON.stringify(known)}`;
  const record = {
    metadata: {
      players: [{ id: 5, role: "awakened_idiot" }],
      normalizedBoard: {
        awakenedIdiot: { protectionRepeatPolicy: "awa_nonconsecutive_nights_v1" },
      },
    },
    decisions: [
      {
        actorId: 5,
        day: 1,
        stage: "secret_body",
        request: { phase: "night", context: { visible_events: [fact] } },
      },
    ],
  } as unknown as NobleWireRun["record"];
  return {
    record,
    sdkWireMessages:
      kind === "sdk"
        ? [
            {
              actor: 5,
              ordinal: 1,
              messages: [
                { role: "system", content: "NOBLE_PRIVATE_ACTOR_5" },
                {
                  role: "user",
                  content: JSON.stringify({ event: [fact.seq, fact.type, fact.payload] }),
                },
                { role: "user", content: current },
              ],
            },
          ]
        : [],
    acpTraces:
      kind === "acp"
        ? [
            {
              actor: 5,
              trace: {
                prompts: [
                  "NOBLE_PRIVATE_ACTOR_5",
                  `${current}\n${JSON.stringify({ events: [[fact.seq, fact.type, fact.payload]] })}`,
                ],
                arrivals: [{ actorOrdinal: 1 }],
                activeSchemas: [{ actorOrdinal: 1, body: structuredClone(schema) }],
              },
            },
          ]
        : [],
  };
}
test("positive literal ACP known state and static schema", () => {
  expect(() => assertNobleTransportWire(input())).not.toThrow();
});
test("positive literal SDK known state and exact event suffix", () => {
  expect(() => assertNobleTransportWire(input("sdk"))).not.toThrow();
});
test("actual active MCP schema must reject an extra stock field, regardless of blacklist spelling", () => {
  const r = input();
  (r.acpTraces[0]!.trace.activeSchemas[0]!.body as any).secretBody = {
    resource: "spent",
    targetId: 6,
    day: 1,
  };
  expect(() => assertNobleTransportWire(r)).toThrow();
});
test("actual active MCP schema must reject an empty schema", () => {
  const r = input();
  r.acpTraces[0]!.trace.activeSchemas[0]!.body = {};
  expect(() => assertNobleTransportWire(r)).toThrow();
});
for (const kind of ["acp", "sdk"] as const)
  test(`${kind} current prompt must reject a second contradictory status`, () => {
    const r = input(kind),
      extra = `\nYour last announced body state (night consumption is announced next night): ${JSON.stringify({ ...known, resource: "spent" })}`;
    if (kind === "acp") r.acpTraces[0]!.trace.prompts[1] += extra;
    else (r.sdkWireMessages[0]!.messages[2] as any).content += extra;
    expect(() => assertNobleTransportWire(r)).toThrow();
  });
