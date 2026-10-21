/**
 * 单元测试以字面 ACP／SDK 已知状态及事件后缀为输入，用精确接受及伪造当前字段断言核对 Noble／Secret Body 共享夹具验证。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import {
  assertNobleTransportWire,
  type NobleWireRun,
} from "../../../support/features/noble-secret-body/oracles/wire";

// 字面的 owner 通知及初态：本单元核对实际传输检查器，
// 不核对档案解析器，也不查询 World／投影来生成预期输入。
const known = {
  protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
  lastNotifiedNight: 1,
  lastChoice: null,
  resource: "intact",
  publicRevealDay: null,
  awaitingNightReport: false,
};
// 独立手写当前固定协议，包含自爆确认，不复用被测检查器的预期。
const schema = {
  actions: {
    choose_servant: {
      type: "object",
      properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
      required: ["target_id"],
      additionalProperties: false,
    },
    protect_secret_body: {
      type: "object",
      properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
      required: ["target_id"],
      additionalProperties: false,
    },
    report_bug: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["flow", "rule", "state", "logging", "other"] },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        message: { type: "string" },
      },
      required: ["category", "severity", "message"],
      additionalProperties: false,
    },
  },
  protocol_version: "1",
  tools: {
    get_game_schema: "{}; query the fixed tool protocol without returning game state.",
    submit_action:
      "{ turn_id, action, arguments, confirmation_id? }; select one validated action. Self-destruction first proposes only; read the warning and resubmit unchanged with its confirmation ID. No confirmation means skip. resolved includes your authorized result; committed only confirms registration. applied does not guarantee final damage or protection. Without feedback, applied=false still awaits rule resolution.",
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
for (const action of ["choose_servant", "protect_secret_body", "report_bug"] as const)
  test(`actual active MCP schema must reject a missing public ${action} definition`, () => {
    const r = input();
    const body = r.acpTraces[0]!.trace.activeSchemas[0]!.body as typeof schema;
    delete (body.actions as Partial<typeof schema.actions>)[action];
    expect(() => assertNobleTransportWire(r)).toThrow("fixture_noble_action_schema_invalid");
  });
test("actual active MCP schema must reject altered Noble target semantics", () => {
  const r = input();
  const body = r.acpTraces[0]!.trace.activeSchemas[0]!.body as typeof schema;
  body.actions.choose_servant.properties.target_id.minimum = 0;
  expect(() => assertNobleTransportWire(r)).toThrow("fixture_noble_action_schema_invalid");
});
for (const kind of ["acp", "sdk"] as const)
  test(`${kind} current prompt must reject a second contradictory status`, () => {
    const r = input(kind),
      extra = `\nYour last announced body state (night consumption is announced next night): ${JSON.stringify({ ...known, resource: "spent" })}`;
    if (kind === "acp") r.acpTraces[0]!.trace.prompts[1] += extra;
    else (r.sdkWireMessages[0]!.messages[2] as any).content += extra;
    expect(() => assertNobleTransportWire(r)).toThrow();
  });
