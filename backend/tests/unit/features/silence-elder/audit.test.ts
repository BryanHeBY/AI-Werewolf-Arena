/**
 * 独立因果账本单元：字面牌组、请求及事实核普通/PK、匿名/私有边界和失败付款前缀。
 * 这里只验证机制账本，不冒充完整Tape结构正例；真实解析及同构建重放由整局传输测试另证。
 */
import { expect, test } from "bun:test";
import { SILENCE_ELDER_POLICY as policy } from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { silenceElderTwelveConfig } from "../../../../src/rulesets/presets/silence-elder-twelve";
import { validateSilenceElderRecord } from "../../../../src/recording/verification/silence-elder/validate";
import type { ReproductionRecord } from "../../../../src/recording/reproduction/format";
const roles = [
  "wolf",
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
  "silence_elder",
];
const description = "  🐺 → ?  ",
  text = "  My interpretation.  ";
function fixture(translate: "text" | "decline" | "none" = "text", pk = false): ReproductionRecord {
  const translator = translate === "none" ? null : 9;
  const events: any[] = [
    { timestamp: 1, type: "phase_changed", payload: { day: 1, phase: "night" } },
    {
      timestamp: 2,
      type: "silence_chosen",
      payload: { policy, day: 1, actorId: 12, targetId: 1, translatorId: translator },
      audience: [12],
    },
    { timestamp: 3, type: "phase_changed", payload: { day: 1, phase: "day" } },
    { timestamp: 4, type: "night_resolved", payload: { deaths: [] } },
    {
      timestamp: 5,
      type: "silence_announced",
      payload: { policy, day: 1, targetId: 1, translatorId: translator },
    },
    {
      timestamp: 6,
      type: "silence_gesture",
      payload: { policy, day: 1, actorId: 1, round: "day", description },
    },
  ];
  const decisions: any[] = [];
  function decision(
    actorId: number,
    stage: string,
    tool: string,
    args: unknown,
    cursor: number,
    extra: object,
    phase = "day",
  ) {
    const feed = events
      .slice(0, cursor)
      .filter((e) => e.type.startsWith("silence_") && (!e.audience || e.audience.includes(actorId)))
      .map((e, i) => ({ seq: i + 1, type: e.type, payload: structuredClone(e.payload) }));
    decisions.push({
      actorId,
      day: 1,
      stage,
      openedAtEventCount: cursor,
      settleOrder: decisions.length + 1,
      request: {
        actorId,
        phase,
        allowedTools: [tool],
        context: {
          day: 1,
          stage,
          visible_events: feed,
          turn_constraints: {},
          action_failure_policy: "error",
          allow_fallback: false,
          ...extra,
        },
      },
      outcome: { kind: "action", action: { name: tool, args } },
    });
  }
  decision(
    12,
    "silence_elder",
    "silence",
    { target_id: 1, translator_id: translator },
    1,
    { silence_candidates: Array.from({ length: 12 }, (_, i) => i + 1) },
    "night",
  );
  decision(1, "silence_gesture", "gesture", { description }, 5, {
    silence_target_id: 1,
    silence_translator_id: translator,
    silence_round: "day",
  });
  if (translator !== null) {
    decision(
      9,
      "silence_translation",
      "translate_silence",
      { text: translate === "decline" ? null : text },
      6,
      {
        silence_target_id: 1,
        silence_translator_id: 9,
        silence_round: "day",
        silence_gesture_description: description,
      },
    );
    events.push({
      timestamp: 7,
      type: translate === "decline" ? "silence_translation_declined" : "silence_translated",
      payload: {
        policy,
        day: 1,
        actorId: 9,
        targetId: 1,
        round: "day",
        ...(translate === "decline" ? {} : { text }),
      },
      ...(translate === "decline" ? { audience: [9] } : {}),
    });
  }
  if (pk) {
    events.push(
      { timestamp: 8, type: "phase_changed", payload: { day: 1, phase: "voting" } },
      { timestamp: 9, type: "exile_pk_started", payload: { candidates: [1, 2] } },
    );
    const cursor = events.length;
    decision(
      1,
      "silence_gesture",
      "gesture",
      { description },
      cursor,
      { silence_target_id: 1, silence_translator_id: translator, silence_round: "pk" },
      "voting",
    );
    events.push({
      timestamp: 10,
      type: "silence_gesture",
      payload: { policy, day: 1, actorId: 1, round: "pk", description },
    });
    if (translator !== null) {
      decision(
        9,
        "silence_translation",
        "translate_silence",
        { text: null },
        events.length,
        {
          silence_target_id: 1,
          silence_translator_id: 9,
          silence_round: "pk",
          silence_gesture_description: description,
        },
        "voting",
      );
      events.push({
        timestamp: 11,
        type: "silence_translation_declined",
        payload: { policy, day: 1, actorId: 9, targetId: 1, round: "pk" },
        audience: [9],
      });
    }
  }
  events.push(
    {
      timestamp: 12,
      type: "silence_expired",
      payload: { policy, day: 1, targetId: 1 },
      audience: [],
    },
    { timestamp: 13, type: "phase_changed", payload: { day: 2, phase: "night" } },
  );
  return {
    metadata: {
      normalizedBoard: structuredClone(silenceElderTwelveConfig),
      players: roles.map((role, i) => ({ id: i + 1, role, camp: i < 4 ? "wolf" : "good" })),
    },
    events,
    decisions,
    checkpoints: [
      {
        eventCount: events.length,
        decisionCount: decisions.length,
        settlementCount: decisions.length,
        complete: true,
        players: roles.map((role, i) => ({
          id: i + 1,
          role,
          camp: i < 4 ? "wolf" : "good",
          alive: true,
          vote: { canVote: true, weight: 1 },
          badge: { isSheriff: false, destroyed: false },
          privateState:
            i === 11
              ? {
                  silenceElder: {
                    policy,
                    history: [{ day: 1, targetId: 1, translatorId: translator }],
                  },
                }
              : {},
        })),
      },
    ],
  } as unknown as ReproductionRecord;
}
for (const translation of ["text", "decline", "none"] as const)
  for (const pk of [false, true])
    test(`字面因果闭环/${translation}/PK=${pk}`, () =>
      expect(() => validateSilenceElderRecord(fixture(translation, pk))).not.toThrow());
const mutations: Record<string, (r: ReproductionRecord) => void> = {
  匿名公告不能加actor: (r) => Object.assign(r.events[4]!.payload, { actorId: 12 }),
  译文不能改原文: (r) => Object.assign(r.events[6]!.payload, { text: "forged" }),
  译者不能冒名: (r) => Object.assign(r.events[6]!.payload, { actorId: 8 }),
  动作不能冒名: (r) => Object.assign(r.events[5]!.payload, { actorId: 2 }),
  普通发言不能绕禁言: (r) =>
    r.events.splice(7, 0, {
      timestamp: 15,
      type: "day_speech",
      payload: { actorId: 1, text: "bypass" },
    }),
  缺失翻译不能假完成: (r) => {
    r.events.splice(6, 1);
    r.checkpoints[0]!.eventCount--;
  },
  重复动作不能二次表达: (r) => r.events.splice(7, 0, structuredClone(r.events[5]!)),
  过期不能公开: (r) => {
    delete r.events.find((e) => e.type === "silence_expired")!.audience;
  },
  夜选不向目标泄漏: (r) => {
    r.decisions[1]!.request.context.visible_events.push({
      seq: 99,
      type: "silence_chosen",
      payload: structuredClone(r.events[1]!.payload),
    });
  },
  公开动作不得遗漏: (r) => {
    r.decisions[2]!.request.context.visible_events = [];
  },
  未来译文不能提前给目标: (r) =>
    r.decisions[1]!.request.context.visible_events.push({
      seq: 99,
      type: "silence_translated",
      payload: structuredClone(r.events[6]!.payload),
    }),
  完成检查点付费目标必须一致: (r) => {
    (r.checkpoints[0]!.players[11]!.privateState.silenceElder as any).history[0].targetId = 2;
  },
  其他玩家不能有长老库存: (r) =>
    Object.assign(r.checkpoints[0]!.players[0]!.privateState, {
      silenceElder: { policy, history: [] },
    }),
  投票权不因禁言失去: (r) => {
    r.checkpoints[0]!.players[0]!.vote.canVote = false;
  },
  PK译者不必是候选但目标必须是: (r) => {
    const e = r.events.find((e) => e.type === "exile_pk_started")!;
    e.payload.candidates = [2, 3];
  },
};
for (const [name, mutate] of Object.entries(mutations))
  test(name, () => {
    const r = fixture("text", true);
    mutate(r);
    expect(() => validateSilenceElderRecord(r)).toThrow("reproduction_silence_elder_invalid");
  });
function failedPrefix(): ReproductionRecord {
  const r = fixture();
  r.events = r.events.slice(0, 1);
  r.decisions = r.decisions.slice(0, 1);
  const d = r.decisions[0]!;
  d.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  d.returnedCandidate = { name: "silence", args: { target_id: 1, translator_id: 9 } };
  const cp = r.checkpoints[0]!;
  cp.complete = false;
  cp.eventCount = 1;
  cp.decisionCount = 1;
  cp.settlementCount = 1;
  return r;
}
test("真实error形状的已知候选可保未发表付款前缀", () =>
  expect(() => validateSilenceElderRecord(failedPrefix())).not.toThrow());
for (const pair of [
  [2, 9],
  [1, 1],
  [99, 9],
  [1, 8],
] as const)
  test(`失败CP不能伪造付款${pair}`, () => {
    const r = failedPrefix();
    (r.checkpoints[0]!.players[11]!.privateState.silenceElder as any).history = [
      { day: 1, targetId: pair[0], translatorId: pair[1] },
    ];
    expect(() => validateSilenceElderRecord(r)).toThrow("reproduction_silence_elder_invalid");
  });

test("已付长老当夜死亡仍保目标动作与译文", () => {
  const r = fixture();
  (r.events[3]!.payload as { deaths: number[] }).deaths = [12];
  r.checkpoints[0]!.players[11]!.alive = false;
  expect(() => validateSilenceElderRecord(r)).not.toThrow();
});
test("已付目标夜死不公告也不伪造表达，日末仍清作用域", () => {
  const r = fixture();
  (r.events[3]!.payload as { deaths: number[] }).deaths = [1];
  r.events.splice(4, 3);
  r.decisions = r.decisions.slice(0, 1);
  const cp = r.checkpoints[0]!;
  cp.players[0]!.alive = false;
  cp.eventCount = r.events.length;
  cp.decisionCount = 1;
  cp.settlementCount = 1;
  expect(() => validateSilenceElderRecord(r)).not.toThrow();
});
test("已付译者夜死公告无译者，不制造拒译事实", () => {
  const r = fixture();
  (r.events[3]!.payload as { deaths: number[] }).deaths = [9];
  r.events[4]!.payload.translatorId = null;
  r.events.splice(6, 1);
  r.decisions = r.decisions.slice(0, 2);
  r.decisions[1]!.request.context.silence_translator_id = null;
  r.decisions[1]!.request.context.visible_events[0]!.payload.translatorId = null;
  const cp = r.checkpoints[0]!;
  cp.players[8]!.alive = false;
  cp.eventCount = r.events.length;
  cp.decisionCount = 2;
  cp.settlementCount = 2;
  expect(() => validateSilenceElderRecord(r)).not.toThrow();
});

test("未来cursor和完整未来feed不能反向证明已发表手势", () => {
  const r = fixture();
  const d = r.decisions[1]!;
  d.openedAtEventCount = 6;
  d.request.context.visible_events.push({
    seq: 99,
    type: "silence_gesture",
    payload: structuredClone(r.events[5]!.payload),
  });
  expect(() => validateSilenceElderRecord(r)).toThrow("reproduction_silence_elder_invalid");
});
