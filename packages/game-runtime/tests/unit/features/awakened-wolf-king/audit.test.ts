/**
 * 字面机制账本单元核永久传出、受传单爪及按单位的消费/私有知识，不由运行库存生成oracle。
 * 此处是独立verifier单元，不伪装完整Tape；真实解析与同构建复现另由完整场景及协议测试提供。
 */
import { expect, test } from "bun:test";
import { AWAKENED_CLAW_POLICY as policy } from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import {
  awakenedWolfKingTenConfig,
  awakenedWolfKingTwelveConfig,
} from "../../../../src/rulesets/presets/awakened-wolf-king";
import { awakenedWitchTwelveConfig } from "../../../../src/rulesets/presets/awakened-witch-twelve";
import { validateAwakenedClawRecord } from "../../../../src/recording/verification/awakened-wolf-king/validate";
import type { ReproductionRecord } from "../../../../src/recording/reproduction/format";
const roles = [
  "wolf",
  "wolf",
  "awakened_wolf_king",
  "villager",
  "villager",
  "villager",
  "villager",
  "seer",
  "witch",
  "miracle_merchant",
];
function fixture(): ReproductionRecord {
  const native = "awakened_claw:native:",
    received = "awakened_claw:bequest:3:1:1";
  const events: any[] = [
    { timestamp: 1, type: "phase_changed", payload: { day: 1, phase: "night" } },
    {
      timestamp: 2,
      type: "awakened_claw_bequeathed",
      payload: {
        policy,
        day: 1,
        actorId: 3,
        targetId: 1,
        unitId: native + "1",
        receivedUnitId: received,
      },
      audience: [1, 3],
    },
    { timestamp: 3, type: "phase_changed", payload: { day: 1, phase: "day" } },
    { timestamp: 4, type: "night_resolved", payload: { deaths: [1] } },
    {
      timestamp: 5,
      type: "awakened_claw_spent",
      payload: { policy, day: 1, actorId: 1, targetId: 4, unitId: received },
      audience: [1],
    },
    { timestamp: 6, type: "player_shot", payload: { actorId: 1, targetId: 4 } },
    { timestamp: 7, type: "additional_deaths", payload: { deaths: [4] } },
    { timestamp: 8, type: "phase_changed", payload: { day: 1, phase: "voting" } },
    { timestamp: 9, type: "voted_out", payload: { target: 3 } },
    {
      timestamp: 10,
      type: "awakened_claw_spent",
      payload: { policy, day: 1, actorId: 3, targetId: 5, unitId: native + "2" },
      audience: [3],
    },
    { timestamp: 11, type: "player_shot", payload: { actorId: 3, targetId: 5 } },
    { timestamp: 12, type: "additional_deaths", payload: { deaths: [5] } },
    { timestamp: 13, type: "phase_changed", payload: { day: 2, phase: "night" } },
  ];
  const decisions: any[] = [];
  function decision(
    actorId: number,
    stage: string,
    name: string,
    args: object,
    cursor: number,
    phase: string,
    extra: object,
  ) {
    const visible_events = events
      .slice(0, cursor)
      .filter((e) => e.type.startsWith("awakened_claw") && e.audience?.includes(actorId))
      .map((e, i) => ({ seq: i + 1, type: e.type, payload: structuredClone(e.payload) }));
    decisions.push({
      actorId,
      stage,
      day: 1,
      openedAtEventCount: cursor,
      settleOrder: decisions.length + 1,
      request: {
        actorId,
        phase,
        allowedTools: [name],
        context: {
          day: 1,
          stage,
          visible_events,
          turn_constraints: {},
          action_failure_policy: "error",
          allow_fallback: false,
          ...extra,
        },
      },
      outcome: { kind: "action", action: { name, args } },
    });
  }
  decision(3, "awakened_claw_bequest", "bequeath_claw", { target_id: 1 }, 1, "night", {
    claw_bequest_candidates: [1, 2],
  });
  decision(1, "death_shot", "shoot", { target_id: 4 }, 4, "day", {
    ability_id: received,
    death_action_id: 1,
    death_phase: "night",
    death_sources: ["wolf_kill"],
    shoot_candidates: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  });
  decision(3, "death_shot", "shoot", { target_id: 5 }, 9, "voting", {
    ability_id: native + "2",
    death_action_id: 2,
    death_phase: "voting",
    death_sources: ["exile"],
    shoot_candidates: [2, 5, 6, 7, 8, 9, 10],
  });
  const king = {
    policy,
    units: [
      { id: native + "1", source: { kind: "native", index: 1 }, status: "transferred" },
      { id: native + "2", source: { kind: "native", index: 2 }, status: "spent" },
    ],
    bequests: [{ day: 1, targetId: 1, unitId: native + "1" }],
  };
  const receiver = {
    policy,
    units: [
      {
        id: received,
        source: { kind: "bequest", giverId: 3, giverUnitId: native + "1", day: 1 },
        status: "spent",
      },
    ],
    bequests: [],
  };
  return {
    metadata: {
      normalizedBoard: structuredClone(awakenedWolfKingTenConfig),
      players: roles.map((role, i) => ({ id: i + 1, role, camp: i < 3 ? "wolf" : "good" })),
    },
    events,
    decisions,
    operations: [
      {
        scope: "resolution",
        op: "night_damage_resolved",
        status: "success",
        output: { deaths: [1], death_sources: { 1: ["wolf_kill"] } },
      },
    ],
    checkpoints: [
      {
        complete: true,
        eventCount: events.length,
        decisionCount: 3,
        settlementCount: 3,
        players: roles.map((role, i) => ({
          id: i + 1,
          role,
          camp: i < 3 ? "wolf" : "good",
          alive: ![1, 3, 4, 5].includes(i + 1),
          privateState:
            i === 2 ? { awakenedClaws: king } : i === 0 ? { awakenedClaws: receiver } : {},
        })),
      },
    ],
  } as unknown as ReproductionRecord;
}
test("真实来源的字面传授/受传/原生消费账本闭合", () =>
  expect(() => validateAwakenedClawRecord(fixture())).not.toThrow());
const mutations: Record<string, (r: ReproductionRecord) => void> = {
  不能把已传爪返给狼王: (r) => {
    (r.checkpoints[0]!.players[2]!.privateState.awakenedClaws as any).units[0].status = "ready";
  },
  不能凭空给别的狼安装收到库存: (r) => {
    r.checkpoints[0]!.players[1]!.privateState.awakenedClaws = structuredClone(
      r.checkpoints[0]!.players[0]!.privateState.awakenedClaws,
    );
  },
  私有传授不得给第三只狼: (r) => {
    r.events[1]!.audience = [1, 2, 3];
  },
  消费不得公开: (r) => {
    delete r.events[4]!.audience;
  },
  God失效不能代替真实消费: (r) => {
    r.events[9]!.type = "awakened_claws_expired";
    r.events[9]!.payload = { policy, day: 1, actorId: 3, unitIds: ["awakened_claw:native:2"] };
    r.events[9]!.audience = [];
  },
  受传不能挪用狼王第二爪: (r) => {
    r.events[4]!.payload.unitId = "awakened_claw:native:2";
  },
  不能将传给队友伪造为传给好人: (r) => {
    r.events[1]!.payload.targetId = 4;
    r.events[1]!.audience = [3, 4];
  },
  付款事实必须对应真实动作目标: (r) => {
    r.events[9]!.payload.targetId = 6;
  },
  不能消费后不提交真实死亡或保护: (r) => {
    r.events.splice(10, 1);
    r.checkpoints[0]!.eventCount--;
  },
  死因不能自报改成允许来源: (r) => {
    r.operations[0]!.output!.death_sources = { 1: ["poison"] };
  },
  本人feed不能漏掉已收传授: (r) => {
    r.decisions[1]!.request.context.visible_events = [];
  },
  其余狼请求不能看对方消费: (r) => {
    r.decisions[2]!.request.context.visible_events.push({
      seq: 99,
      type: r.events[4]!.type,
      payload: structuredClone(r.events[4]!.payload),
    });
  },
  同值unitId不替代发布前权限: (r) => {
    r.decisions[1]!.request.context.ability_id = "awakened_claw:bequest:3:2:1";
  },
  名单不能包含第一枪已死目标: (r) => {
    r.decisions[2]!.request.context.shoot_candidates = [
      ...r.decisions[2]!.request.context.shoot_candidates!,
      4,
    ];
  },
};
for (const [name, mutate] of Object.entries(mutations))
  test(name, () => {
    const r = fixture();
    mutate(r);
    expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
  });
test("空枪也消费且没有player_shot", () => {
  const r = fixture();
  r.events[9]!.payload.targetId = null;
  r.events.splice(10, 2);
  r.decisions[2]!.outcome = {
    kind: "action",
    action: { name: "shoot", args: { target_id: null } },
  };
  r.checkpoints[0]!.players[4]!.alive = true;
  r.checkpoints[0]!.eventCount = r.events.length;
  expect(() => validateAwakenedClawRecord(r)).not.toThrow();
});
test("原十人没有梦保护，不能伪造blocked代替实际死亡", () => {
  const r = fixture();
  r.events[5]!.type = "death_shot_blocked";
  r.events[5]!.payload = { actorId: 1, targetId: 4, reason: "night_protection" };
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});
function protectedTwelve(): ReproductionRecord {
  const r = fixture();
  r.metadata.normalizedBoard = structuredClone(awakenedWolfKingTwelveConfig);
  r.metadata.players.push(
    { id: 11, role: "wolf", camp: "wolf" } as any,
    { id: 12, role: "dreamer", camp: "good" } as any,
  );
  for (const p of r.metadata.players.slice(-2))
    r.checkpoints[0]!.players.push({ ...p, alive: true, privateState: {} } as any);
  r.events.splice(2, 0, {
    timestamp: 31,
    type: "dream_applied",
    payload: { actorId: 12, targetId: 4, day: 1, consecutive: false },
  });
  r.decisions[0]!.request.context.claw_bequest_candidates = [1, 2, 11];
  for (const d of r.decisions.slice(1)) {
    d.openedAtEventCount!++;
    d.request.context.shoot_candidates = [...d.request.context.shoot_candidates!, 11, 12];
  }
  r.events[6]!.type = "death_shot_blocked";
  r.events[6]!.payload = { actorId: 1, targetId: 4, reason: "night_protection" };
  r.events.splice(7, 1);
  r.decisions[2]!.openedAtEventCount!--;
  r.decisions[2]!.request.context.shoot_candidates = [2, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  r.checkpoints[0]!.players[3]!.alive = true;
  r.checkpoints[0]!.eventCount = r.events.length;
  r.decisions.push({
    actorId: 12,
    day: 1,
    stage: "dreamer",
    openedAtEventCount: 2,
    settleOrder: 4,
    request: {
      actorId: 12,
      phase: "night",
      allowedTools: ["dream"],
      context: {
        day: 1,
        stage: "dreamer",
        visible_events: [],
        turn_constraints: {},
        ability_id: "native:dream",
      },
    },
    outcome: { kind: "action", action: { name: "dream", args: { target_id: 4 } } },
  } as any);
  r.checkpoints[0]!.decisionCount = 4;
  r.checkpoints[0]!.settlementCount = 4;
  return r;
}
test("原十二人夜源爪命中当夜被梦者仍消费但不死亡", () =>
  expect(() => validateAwakenedClawRecord(protectedTwelve())).not.toThrow());
test("原十二人夜源爪不能跳过已有梦保护伪造击杀", () => {
  const r = protectedTwelve();
  r.events[6]!.type = "player_shot";
  r.events[6]!.payload = { actorId: 1, targetId: 4 };
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});

function failedShotPrefix(): ReproductionRecord {
  const r = fixture();
  r.finalized = true;
  r.events = r.events.slice(0, 9);
  const d = r.decisions[2]!;
  d.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  d.returnedCandidate = { name: "shoot", args: { target_id: 5 } };
  const cp = r.checkpoints[0]!;
  cp.complete = false;
  cp.eventCount = r.events.length;
  cp.players[4]!.alive = true;
  return r;
}
test("真实error候选限制未发表消费，保已发表的第一枚受传爪与死亡", () =>
  expect(() => validateAwakenedClawRecord(failedShotPrefix())).not.toThrow());
for (const target of [6, 3, 99])
  test(`未发表消费候选${target}按原活人范围约束`, () => {
    const r = failedShotPrefix();
    r.decisions[2]!.returnedCandidate = { name: "shoot", args: { target_id: target } };
    // 此CP只记单位消费，目标没有公开；合法但不同的活目标仍由真实候选自身说明，不能凭空造死亡。
    if (target === 6) expect(() => validateAwakenedClawRecord(r)).not.toThrow();
    else expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
  });
test("未知Provider错误无候选不能消费未发表单位", () => {
  const r = failedShotPrefix();
  delete r.decisions[2]!.returnedCandidate;
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});
test("完整档案不得省略真实夜伤来源操作，live待证前缀可稍后补齐", () => {
  const r = fixture();
  r.operations = [];
  r.finalized = true;
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
  r.finalized = false;
  expect(() => validateAwakenedClawRecord(r)).not.toThrow();
});
function failedBequest(install: boolean): ReproductionRecord {
  const r = fixture();
  r.finalized = true;
  r.events = r.events.slice(0, 1);
  r.decisions = r.decisions.slice(0, 1);
  r.operations = [];
  const d = r.decisions[0]!;
  d.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  d.returnedCandidate = { name: "bequeath_claw", args: { target_id: 1 } };
  const cp = r.checkpoints[0]!;
  cp.complete = false;
  cp.eventCount = 1;
  cp.decisionCount = 1;
  cp.settlementCount = 1;
  for (const p of cp.players) p.alive = true;
  (cp.players[2]!.privateState.awakenedClaws as any).units[1].status = "ready";
  if (install) (cp.players[0]!.privateState.awakenedClaws as any).units[0].status = "ready";
  else delete cp.players[0]!.privateState.awakenedClaws;
  return r;
}
for (const install of [false, true])
  test(`传授失败保首扣与可选次安装前缀/${install}`, () =>
    expect(() => validateAwakenedClawRecord(failedBequest(install))).not.toThrow());
for (const target of [2, 3, 99])
  test(`已知传授候选${target}不能伪造CP历史目标`, () => {
    const r = failedBequest(true);
    r.decisions[0]!.returnedCandidate = { name: "bequeath_claw", args: { target_id: target } };
    expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
  });
test("梦初始牵连差集只能由当夜摄梦关系解释，不能任意加公告死亡", () => {
  const r = protectedTwelve(),
    bequest = r.events[1]!;
  r.events = [
    r.events[0]!,
    bequest,
    {
      timestamp: 3,
      type: "dream_applied",
      payload: { actorId: 12, targetId: 4, day: 1, consecutive: false },
    },
    { timestamp: 4, type: "phase_changed", payload: { day: 1, phase: "day" } },
    { timestamp: 5, type: "night_resolved", payload: { deaths: [4, 12] } },
    { timestamp: 6, type: "phase_changed", payload: { day: 2, phase: "night" } },
  ];
  r.decisions = [r.decisions[0]!, r.decisions.at(-1)!];
  r.operations[0]!.output = { deaths: [12], death_sources: { 12: ["poison"] } };
  const cp = r.checkpoints[0]!;
  cp.eventCount = 6;
  cp.decisionCount = 2;
  cp.settlementCount = 4;
  for (const p of cp.players) p.alive = ![4, 12].includes(p.id);
  (cp.players[2]!.privateState.awakenedClaws as any).units[1].status = "ready";
  (cp.players[0]!.privateState.awakenedClaws as any).units[0].status = "ready";
  expect(() => validateAwakenedClawRecord(r)).not.toThrow();
  r.events[4]!.payload.deaths = [4, 7, 12];
  cp.players[6]!.alive = false;
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});

test("有原生爪的真实夜结算不能缺传授请求或把error当null空过", () => {
  for (const mode of ["missing", "error"] as const) {
    const r = fixture();
    if (mode === "missing") r.decisions.shift();
    else r.decisions[0]!.outcome = { kind: "error", code: "decision_failed", name: "Error" };
    expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
  }
});
test("完成CP不能把无消费的窗口失败伪装为正常", () => {
  const r = failedBequest(false);
  delete r.checkpoints[0]!.players[0]!.privateState.awakenedClaws;
  (r.checkpoints[0]!.players[2]!.privateState.awakenedClaws as any) = {
    policy,
    units: [
      { id: "awakened_claw:native:1", source: { kind: "native", index: 1 }, status: "ready" },
      { id: "awakened_claw:native:2", source: { kind: "native", index: 2 }, status: "ready" },
    ],
    bequests: [],
  };
  r.checkpoints[0]!.complete = true;
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});

for (const kind of [
  "missing_action",
  "future_action",
  "wrong_target",
  "wrong_consecutive",
  "duplicate_night",
] as const)
  test(`梦保护不能凭事实自证/${kind}`, () => {
    const r = protectedTwelve(),
      dream = r.decisions.at(-1)!;
    if (kind === "missing_action") r.decisions.pop();
    if (kind === "future_action") dream.openedAtEventCount = 4;
    if (kind === "wrong_target") (dream.outcome as any).action.args.target_id = 5;
    if (kind === "wrong_consecutive") r.events[2]!.payload.consecutive = true;
    if (kind === "duplicate_night") r.events.splice(3, 0, structuredClone(r.events[2]!));
    expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
  });
test("连摄由上一真实夜决定推导，不能改false补造夜枪保护", () => {
  const r = protectedTwelve(),
    cursor = r.events.length;
  r.events.push({
    timestamp: 99,
    type: "dream_applied",
    payload: { actorId: 12, day: 2, targetId: 4, consecutive: true },
  });
  const d = structuredClone(r.decisions.at(-1)!);
  d.day = d.request.context.day = 2;
  d.openedAtEventCount = cursor;
  d.settleOrder = 5;
  r.decisions.push(d);
  r.checkpoints[0]!.eventCount++;
  r.checkpoints[0]!.decisionCount = r.checkpoints[0]!.settlementCount = 5;
  expect(() => validateAwakenedClawRecord(r)).not.toThrow();
  r.events.at(-1)!.payload.consecutive = false;
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});

/** 手写原十人原生双爪与受赠枪子链；不借生产resolver生成顺序预期。 */
function doubleClawChild(): ReproductionRecord {
  const r = fixture(),
    unit = "awakened_claw:native:";
  r.events = [
    { timestamp: 1, type: "phase_changed", payload: { day: 1, phase: "voting" } },
    { timestamp: 2, type: "voted_out", payload: { target: 3 } },
    {
      timestamp: 3,
      type: "awakened_claw_spent",
      payload: { policy, day: 1, actorId: 3, unitId: unit + 1, targetId: 4 },
      audience: [3],
    },
    { timestamp: 4, type: "player_shot", payload: { actorId: 3, targetId: 4 } },
    { timestamp: 5, type: "additional_deaths", payload: { deaths: [4] } },
    { timestamp: 6, type: "player_shot", payload: { actorId: 4, targetId: 6 } },
    { timestamp: 7, type: "additional_deaths", payload: { deaths: [6] } },
    {
      timestamp: 8,
      type: "awakened_claw_spent",
      payload: { policy, day: 1, actorId: 3, unitId: unit + 2, targetId: 5 },
      audience: [3],
    },
    { timestamp: 9, type: "player_shot", payload: { actorId: 3, targetId: 5 } },
    { timestamp: 10, type: "additional_deaths", payload: { deaths: [5] } },
  ];
  function shot(
    actorId: number,
    ability: string,
    target: number,
    cursor: number,
    order: number,
    candidates: number[],
  ) {
    return {
      actorId,
      day: 1,
      stage: "death_shot",
      openedAtEventCount: cursor,
      openedAfterSettlement: order - 1,
      settleOrder: order,
      request: {
        actorId,
        phase: "voting",
        allowedTools: ["shoot"],
        context: {
          day: 1,
          stage: "death_shot",
          visible_events: r.events
            .slice(0, cursor)
            .filter((e) => e.type.startsWith("awakened_claw") && e.audience?.includes(actorId))
            .map((e, i) => ({ seq: i + 1, type: e.type, payload: structuredClone(e.payload) })),
          turn_constraints: {},
          action_failure_policy: "error",
          allow_fallback: false,
          ability_id: ability,
          death_action_id: order,
          death_phase: "voting",
          death_sources: actorId === 3 ? ["exile"] : ["shot"],
          shoot_candidates: candidates,
        },
      },
      outcome: { kind: "action", action: { name: "shoot", args: { target_id: target } } },
    } as any;
  }
  r.decisions = [
    shot(3, unit + 1, 4, 2, 1, [1, 2, 4, 5, 6, 7, 8, 9, 10]),
    shot(4, "merchant_gun:4", 6, 5, 2, [1, 2, 5, 6, 7, 8, 9, 10]),
    shot(3, unit + 2, 5, 7, 3, [1, 2, 5, 7, 8, 9, 10]),
  ];
  r.operations = [];
  const cp = r.checkpoints[0]!;
  cp.eventCount = r.events.length;
  cp.decisionCount = cp.settlementCount = 3;
  for (const p of cp.players) {
    p.alive = ![3, 4, 5, 6].includes(p.id);
    p.privateState = {};
  }
  cp.players[2]!.privateState.awakenedClaws = {
    policy,
    units: [1, 2].map((index) => ({
      id: unit + index,
      source: { kind: "native", index },
      status: "spent",
    })),
    bequests: [],
  };
  return r;
}
test("下一爪等首目标受赠枪真实子链完成，不能把开窗移到父枪公示之后", () => {
  const r = doubleClawChild();
  expect(() => validateAwakenedClawRecord(r)).not.toThrow();
  const d = r.decisions[2]!;
  d.openedAtEventCount = 4;
  d.request.context.shoot_candidates = [1, 2, 5, 6, 7, 8, 9, 10];
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});
test("子枪明确空过仍须先结算，下一爪不能跨过无公示的子请求", () => {
  const r = doubleClawChild(),
    child = r.decisions[1]!,
    next = r.decisions[2]!;
  (child.outcome as any).action.args.target_id = null;
  r.events.splice(5, 2);
  next.openedAtEventCount = 5;
  next.request.context.shoot_candidates = [1, 2, 5, 6, 7, 8, 9, 10];
  r.checkpoints[0]!.players[5]!.alive = true;
  r.checkpoints[0]!.eventCount = r.events.length;
  expect(() => validateAwakenedClawRecord(r)).not.toThrow();
  next.openedAfterSettlement = 1;
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});

test("下一夜传授开窗不能借第一夜库存与候选", () => {
  const r = failedBequest(false),
    d = r.decisions[0]!;
  d.day = d.request.context.day = 2;
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});

test("女巫第三板原生猎人枪完整子链先于下一爪，使用hunterId建立Shot来源", () => {
  const r = doubleClawChild(),
    roles = [
      "wolf",
      "wolf",
      "awakened_wolf_king",
      "hunter",
      "villager",
      "villager",
      "villager",
      "seer",
      "guard",
      "villager",
      "wolf",
      "awakened_witch",
    ];
  r.metadata.normalizedBoard = structuredClone(awakenedWitchTwelveConfig);
  r.metadata.players = roles.map((role, i) => ({
    id: i + 1,
    role,
    camp: [1, 2, 3, 11].includes(i + 1) ? "wolf" : "good",
  })) as any;
  for (const p of r.checkpoints[0]!.players) {
    p.role = roles[p.id - 1] as any;
    p.camp = [1, 2, 3, 11].includes(p.id) ? ("wolf" as any) : ("good" as any);
  }
  for (const p of r.metadata.players.slice(-2))
    r.checkpoints[0]!.players.push({ ...p, alive: true, privateState: {} } as any);
  for (const d of r.decisions)
    d.request.context.shoot_candidates = [...d.request.context.shoot_candidates!, 11, 12];
  delete r.decisions[1]!.request.context.ability_id;
  r.events[5]!.type = "hunter_shot";
  r.events[5]!.payload = { hunterId: 4, targetId: 6 };
  expect(() => validateAwakenedClawRecord(r)).not.toThrow();
  r.decisions[2]!.openedAtEventCount = 4;
  r.decisions[2]!.request.context.shoot_candidates = [1, 2, 5, 6, 7, 8, 9, 10, 11, 12];
  expect(() => validateAwakenedClawRecord(r)).toThrow("reproduction_awakened_claw_invalid");
});
