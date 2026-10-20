/**
 * 单元测试以字面通用反馈、身份状态及双语事实为输入，用手写序列／形状预期核对 Noble／Secret Body 独立传输预期检查器与上帝事实排除。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import {
  assertNobleTransportWire,
  type NobleWireRun,
} from "../../../support/features/noble-secret-body/oracles/wire";

// 纯预期夹具，不冒充完整引擎档案。手写输入
// 表示三个 Body 回合中已被独立验证的 feed；不使用
// 生产投影、折叠器、归约器、World 或生成的预期快照。
// 独立静态传输契约由手工编写，不导入预期检查器
// 或生产 schema 构造器；仅本校准夹具被加强。
// 固定协议包含自爆确认，仍由独立字面输入校准完整协议及隐私拒绝。
function staticSchema(locale: "en" | "zh-CN") {
  return locale === "en"
    ? {
        protocol_version: "1",
        tools: {
          get_game_schema: "{}; query the fixed tool protocol without returning game state.",
          submit_action:
            "{ turn_id, action, arguments, confirmation_id? }; select one validated action. Self-destruction first proposes only; read the warning and resubmit unchanged with its confirmation ID. No confirmation means skip. accepted=true, applied=false means it awaits final engine validation; result events determine its effect.",
          report_bug:
            "{ turn_id, category, severity, message }; report a confirmed engine contradiction.",
        },
      }
    : {
        protocol_version: "1",
        tools: {
          get_game_schema: "{}；查询固定工具协议，不返回局内状态。",
          submit_action:
            "{ turn_id, action, arguments, confirmation_id? }；选择一个通过校验的行动。自爆首次只提案，必须阅读警示，再带确认编号原样提交；不确认即跳过。accepted=true、applied=false 表示尚待引擎最终校验，生效以结果事件为准。",
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
              // 合法的有界 context 可丢弃全部旧事件，同时保留
              // 完整新增量；这里故意不提供全 feed 预期。
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
test("generic unavailable action feedback is legal and does not reveal a God fact", () => {
  const r = run("sdk");
  r.sdkWireMessages[0]!.messages.push({
    role: "tool",
    content: JSON.stringify({ ok: false, error: "noble_body_unavailable" }),
  });
  expect(() => assertNobleTransportWire(r)).not.toThrow();
});
for (const locale of ["en", "zh-CN"] as const)
  for (const kind of ["sdk", "acp"] as const) {
    test(`literal valid feed/known state ${kind}/${locale}`, () => {
      expect(() => assertNobleTransportWire(run(kind, locale))).not.toThrow();
    });
  }
test("ACP zero delta with covered arrival remains legal at oracle boundary", () => {
  const r = run("acp");
  r.record.decisions.push(structuredClone(r.record.decisions[2]!));
  const t = r.acpTraces[0]!.trace;
  t.prompts.push(actionPrompt(2, "en").replace("t3", "t4") + '\n{"events":[]}');
  t.arrivals.push({ actorOrdinal: 4 });
  t.activeSchemas.push({ actorOrdinal: 4, body: staticSchema("en") });
  expect(() => assertNobleTransportWire(r)).not.toThrow();
});
test("reject missing SDK next-night notice", () => {
  const r = run("sdk");
  r.sdkWireMessages[2]!.messages = messages(r, 3).filter(
    (m) => !m.content.includes('"secret_body_night_notified"'),
  );
  expect(() => assertNobleTransportWire(r)).toThrow();
});
test("reject missing ACP next-night notice", () => {
  const r = run("acp");
  r.acpTraces[0]!.trace.prompts[3] =
    actionPrompt(2, "en") + "\n" + JSON.stringify({ events: [tuple(facts[3]!)] });
  expect(() => assertNobleTransportWire(r)).toThrow();
});
test("reject missing SDK actor ordinal capture", () => {
  const r = run("sdk");
  r.sdkWireMessages.splice(1, 1);
  expect(() => assertNobleTransportWire(r)).toThrow("fixture_noble_wire_coverage_missing");
});
test("reject missing complete actor wire", () => {
  const r = run("sdk");
  r.sdkWireMessages = [];
  expect(() => assertNobleTransportWire(r)).toThrow("fixture_noble_wire_coverage_missing");
});
test("reject own future choice in first SDK request", () => {
  const r = run("sdk");
  messages(r).splice(-1, 0, { role: "user", content: JSON.stringify({ event: tuple(facts[1]!) }) });
  expect(() => assertNobleTransportWire(r)).toThrow("fixture_noble_wire_suffix_mismatch");
});
test("reject foreign state replacing latest state", () => {
  const r = run("sdk");
  messages(r).at(-1)!.content =
    "[Action prompt]\nCurrent turn ID: t1\n" +
    status(
      {
        wolfActionPolicy: "standard",
        lastNotifiedNight: 2,
        lastChoice: { day: 2, targetId: 9 },
        contracts: [],
        awaitingNightReport: false,
      },
      "en",
      true,
    );
  expect(() => assertNobleTransportWire(r)).toThrow("fixture_noble_wire_known_state_mismatch");
});
test("reject exact foreign persona marker", () => {
  const r = run("sdk");
  messages(r)[0]!.content += " NOBLE_PRIVATE_ACTOR_1";
  expect(() => assertNobleTransportWire(r)).toThrow("fixture_noble_foreign_history_exposed");
});
test("reject foreign persona marker adjacent to continuation text", () => {
  const r = run("sdk");
  messages(r)[0]!.content += " NOBLE_PRIVATE_ACTOR_1_private_history";
  expect(() => assertNobleTransportWire(r)).toThrow();
});
test("reject foreign current state appended after valid own state", () => {
  const r = run("sdk");
  messages(r).at(-1)!.content +=
    "\n" +
    status(
      {
        wolfActionPolicy: "standard",
        lastNotifiedNight: 2,
        lastChoice: { day: 2, targetId: 9 },
        contracts: [
          {
            id: "servant:night:2",
            targetId: 9,
            createdNight: 2,
            expiresNight: 3,
            status: { kind: "pending" },
          },
        ],
        awaitingNightReport: true,
      },
      "en",
      true,
    );
  expect(() => assertNobleTransportWire(r)).toThrow();
});
test("reject foreign state in retained SDK historical prompt", () => {
  const r = run("sdk");
  messages(r, 3).splice(1, 0, {
    role: "user",
    content:
      "[Action prompt]\nCurrent turn ID: t2\n" +
      status(
        {
          wolfActionPolicy: "standard",
          lastNotifiedNight: 2,
          lastChoice: { day: 2, targetId: 9 },
          contracts: [],
          awaitingNightReport: true,
        },
        "en",
        true,
      ),
  });
  expect(() => assertNobleTransportWire(r)).toThrow();
});
test("reject prematurely spent inventory in retained own historical prompt", () => {
  const r = run("sdk");
  messages(r, 3).splice(1, 0, {
    role: "user",
    content: "[Action prompt]\nCurrent turn ID: t2\n" + status({ ...known[1], resource: "spent" }),
  });
  expect(() => assertNobleTransportWire(r)).toThrow();
});
test("valid exact retained SDK historical action status remains accepted", () => {
  const r = run("sdk");
  messages(r, 3).splice(1, 0, { role: "user", content: actionPrompt(1, "en") });
  expect(() => assertNobleTransportWire(r)).not.toThrow();
});
