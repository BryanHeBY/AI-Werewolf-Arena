/**
 * 单元测试将明确的未来 owner 事实插入更早 SDK 消息，用精确拒绝预期核对 Noble／Secret Body 历史时点，不执行 SDK 请求。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
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
// 固定协议包含自爆确认，未来知识测试仍使用独立手写基线。
function staticSchema(locale: "en" | "zh-CN") {
  return locale === "en"
    ? {
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
      }
    : {
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
          get_game_schema: "{}；查询固定工具协议，不返回局内状态。",
          submit_action:
            "{ turn_id, action, arguments, confirmation_id? }；选择一个通过校验的行动。自爆首次只提案，必须阅读警示，再带确认编号原样提交；不确认即跳过。resolved 携带本人可见结果，committed 只确认登记；applied 不代表最终伤害或保护生效。未附 feedback 的 applied=false 回执仍待规则结算。",
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
test("reject a valid future owner state inserted into earlier SDK history", () => {
  const r = run("sdk");
  messages(r, 1).splice(1, 0, { role: "user", content: actionPrompt(2, "en") });
  expect(() => assertNobleTransportWire(r)).toThrow();
});
