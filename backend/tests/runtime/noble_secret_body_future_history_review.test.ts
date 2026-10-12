import { expect, test } from "bun:test";
import {
  assertNobleTransportWire,
  type NobleWireRun,
} from "../support/features/noble-secret-body/oracles/wire";

// Pure oracle fixtures, not purported full engine records. Handwritten inputs
// model the already independently validated feed at three body turns. No
// production projector, fold, reducer, World, or generated expected snapshots.
// Independent static wire contract, handwritten rather than importing the oracle
// or production schema builder. Only this calibration fixture was strengthened.
function staticSchema(locale: "en" | "zh-CN") {
  return locale === "en"
    ? {
        protocol_version: "1",
        tools: {
          get_game_schema: "{}; query the fixed tool protocol without returning game state.",
          submit_action:
            "{ turn_id, action, arguments }; select one validated action. accepted=true, applied=false means it awaits final engine validation; result events determine its effect.",
          report_bug:
            "{ turn_id, category, severity, message }; report a confirmed engine contradiction.",
        },
      }
    : {
        protocol_version: "1",
        tools: {
          get_game_schema: "{}；查询固定工具协议，不返回局内状态。",
          submit_action:
            "{ turn_id, action, arguments }；选择一个通过校验的行动。accepted=true、applied=false 表示尚待引擎最终校验，生效以结果事件为准。",
          report_bug: "{ turn_id, category, severity, message }；上报明确的引擎矛盾。",
        },
      };
}
const policy = "awa_noble_secret_body_v1";
const initial = {
  protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
  lastNotifiedNight: 1,
  lastChoice: null,
  resource: "intact",
  publicRevealDay: null,
};
const afterChoice = { ...initial, lastChoice: { day: 1, targetId: 6 } };
const nextNight = { ...afterChoice, lastNotifiedNight: 2 };
const f = (seq: number, type: string, payload: Record<string, unknown>) => ({ seq, type, payload });
const facts = [
  f(1, "secret_body_night_notified", { policy, actorId: 5, day: 1, ...initial }),
  f(2, "secret_body_chosen", { policy, actorId: 5, day: 1, targetId: 6 }),
  f(3, "phase_changed", { day: 1, phase: "day" }),
  f(4, "phase_changed", { day: 2, phase: "night" }),
  f(5, "secret_body_night_notified", { policy, actorId: 5, day: 2, ...nextNight }),
];
const sizes = [1, 3, 5];
const phases = ["night", "day", "night"];
const known = [
  { ...initial, awaitingNightReport: false },
  { ...afterChoice, awaitingNightReport: true },
  { ...nextNight, awaitingNightReport: false },
];
function status(value: unknown, locale: "en" | "zh-CN" = "en", noble = false) {
  const label =
    locale === "en"
      ? `Your last announced ${noble ? "servant" : "body"} state (hidden terminal changes arrive next night): `
      : `你的已告知${noble ? "夜仆" : "身体"}状态（隐藏变化到下一夜才告知）：`;
  return label + JSON.stringify(value);
}
function actionPrompt(i: number, locale: "en" | "zh-CN") {
  return `${locale === "en" ? "[Action prompt]\nCurrent turn ID: " : "[行动提示]\n当前回合 ID："}t${i + 1}\n${status(known[i], locale)}`;
}
function tuple(e: (typeof facts)[number]) {
  return [e.seq, e.type, e.payload];
}
function run(kind: "sdk" | "acp", locale: "en" | "zh-CN" = "en"): NobleWireRun {
  const record = {
    metadata: {
      locale,
      players: [{ id: 5, role: "awakened_idiot" }],
      normalizedBoard: {
        awakenedIdiot: { protectionRepeatPolicy: "awa_nonconsecutive_nights_v1" },
        nightNoble: { wolfActionPolicy: "standard" },
      },
    },
    decisions: sizes.map((size, i) => ({
      actorId: 5,
      day: i === 2 ? 2 : 1,
      phase: phases[i],
      request: {
        phase: phases[i],
        context: { visible_events: structuredClone(facts.slice(0, size)) },
      },
    })),
  } as unknown as NobleWireRun["record"];
  return {
    record,
    sdkWireMessages:
      kind === "sdk"
        ? sizes.map((size, i) => ({
            actor: 5,
            ordinal: i + 1,
            messages: [
              { role: "system", content: "NOBLE_PRIVATE_ACTOR_5" },
              // A legitimate bounded context can drop all old events while keeping
              // the complete new delta. This is deliberately not a full-feed oracle.
              ...facts.slice(i ? sizes[i - 1] : 0, size).map((e) => ({
                role: "user",
                content: JSON.stringify({ event: tuple(e) }),
              })),
              { role: "user", content: actionPrompt(i, locale) },
            ],
          }))
        : [],
    acpTraces:
      kind === "acp"
        ? [
            {
              actor: 5,
              trace: {
                prompts: [
                  "Initialization NOBLE_PRIVATE_ACTOR_5",
                  ...sizes.map(
                    (size, i) =>
                      actionPrompt(i, locale) +
                      "\n" +
                      JSON.stringify({
                        events: facts.slice(i ? sizes[i - 1] : 0, size).map(tuple),
                      }),
                  ),
                ],
                arrivals: sizes.map((_, i) => ({ actorOrdinal: i + 1 })),
                activeSchemas: sizes.map((_, i) => ({
                  actorOrdinal: i + 1,
                  body: staticSchema(locale),
                })),
              },
            },
          ]
        : [],
  };
}
function messages(r: NobleWireRun, ordinal = 1) {
  return r.sdkWireMessages[ordinal - 1]!.messages as Array<{ role: string; content: string }>;
}
test("reject a valid future owner state inserted into earlier SDK history", () => {
  const r = run("sdk");
  messages(r, 1).splice(1, 0, { role: "user", content: actionPrompt(2, "en") });
  expect(() => assertNobleTransportWire(r)).toThrow();
});
