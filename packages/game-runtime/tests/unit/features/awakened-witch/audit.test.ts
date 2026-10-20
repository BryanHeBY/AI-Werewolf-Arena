/**
 * 单元测试负责觉醒女巫独立账本的资源/秘密矩阵与失败前缀。输入为人工字面规则预期，输出接受或明确拒绝。
 * 这些是机制ledger输入，非完整Tape正例；真实parser、录制和同构建复现由实际整局协议场景验证。
 */
import { expect, test } from "bun:test";
import { AWAKENED_WITCH_POLICY as policy } from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import { awakenedWitchTwelveConfig } from "../../../../src/rulesets/presets/awakened-witch-twelve";
import { validateAwakenedWitchRecord as verify } from "../../../../src/recording/verification/awakened-witch/validate";
import type { ReproductionRecord } from "../../../../src/recording/reproduction/format";
function fixture(): ReproductionRecord {
  const roles = [
    "wolf",
    "wolf",
    "wolf",
    "awakened_wolf_king",
    "villager",
    "villager",
    "villager",
    "villager",
    "seer",
    "guard",
    "hunter",
    "awakened_witch",
  ];
  const group = { ordinal: 1, targetId: 2, assistantIds: [9] },
    events: any[] = [
      { timestamp: 0, type: "phase_changed", payload: { day: 1, phase: "night" } },
      ...[1, 2, 3, 4].map((actorId) => ({
        timestamp: actorId,
        type: "wolf_kill_vote_cast",
        payload: { actorId, abstain: false, targetId: 5 },
        audience: [1, 2, 3, 4],
      })),
      {
        timestamp: 5,
        type: "awakened_brew_chosen",
        payload: {
          policy,
          day: 1,
          actorId: 12,
          mode: "poison",
          targetId: 2,
          assistantIds: [9],
          ordinal: 1,
        },
        audience: [12],
      },
      { timestamp: 6, type: "brew_started", payload: { policy, day: 1, ...group }, audience: [9] },
      {
        timestamp: 7,
        type: "brew_discussion",
        payload: { policy, day: 1, ordinal: 1, actorId: 9, text: "  原话  " },
        audience: [9],
      },
      {
        timestamp: 8,
        type: "brew_approval",
        payload: { policy, day: 1, ordinal: 1, actorId: 9, approve: true },
        audience: [9],
      },
      {
        timestamp: 9,
        type: "brew_resolved",
        payload: { policy, day: 1, ...group, actorId: 12, outcome: "poison" },
        audience: [],
      },
      { timestamp: 10, type: "phase_changed", payload: { day: 1, phase: "day" } },
      { timestamp: 11, type: "night_resolved", payload: { deaths: [2, 5] } },
    ];
  const decision = (
    actorId: number,
    stage: string,
    name: string,
    args: object,
    cursor: number,
    order: number,
    extra: object,
  ) => ({
    actorId,
    day: 1,
    stage,
    openedAtEventCount: cursor,
    openedAfterSettlement: order - 1,
    settleOrder: order,
    request: {
      actorId,
      phase: "night",
      allowedTools: [name],
      context: {
        day: 1,
        stage,
        visible_events: events
          .slice(0, cursor)
          .filter(
            (e) =>
              [
                "awakened_brew_chosen",
                "brew_started",
                "brew_discussion",
                "brew_approval",
                "brew_resolved",
              ].includes(e.type) && e.audience?.includes(actorId),
          )
          .map((e, i) => ({ seq: i + 1, type: e.type, payload: structuredClone(e.payload) })),
        turn_constraints: {},
        action_failure_policy: "error",
        allow_fallback: false,
        ...extra,
      },
    },
    outcome: { kind: "action", action: { name, args } },
  });
  const row = {
    day: 1,
    mode: "poison",
    ...group,
    discussions: [{ actorId: 9, text: "  原话  " }],
    approvals: [{ actorId: 9, approve: true }],
    outcome: "poison",
  };
  return {
    metadata: {
      normalizedBoard: structuredClone(awakenedWitchTwelveConfig),
      players: roles.map((role, i) => ({ id: i + 1, role, camp: i < 4 ? "wolf" : "good" })),
    },
    events,
    decisions: [
      decision(
        12,
        "awakened_witch",
        "awakened_brew",
        { mode: "poison", target_id: 2, assistant_ids: [9] },
        5,
        5,
        {
          awakened_brew_options: {
            healRemaining: 1,
            brewRemaining: 3,
            usedAssistantIds: [],
            targetIds: Array.from({ length: 12 }, (_, i) => i + 1),
            assistantIds: Array.from({ length: 11 }, (_, i) => i + 1),
            requiredAssistants: 1,
            canPoison: true,
            canHeal: true,
            wolfTarget: 5,
          },
        },
      ),
      decision(9, "brew_discussion", "brew_discuss", { text: "  原话  " }, 7, 6, {
        brew_collaboration: group,
      }),
      decision(9, "brew_approval", "brew_approve", { approve: true }, 8, 7, {
        brew_collaboration: group,
      }),
      ...[1, 2, 3, 4].map((id, i) =>
        decision(id, "wolf_vote", "kill_vote", { target_id: 5 }, i + 1, i + 1, {}),
      ),
    ],
    operations: [
      {
        scope: "resolution",
        op: "night_damage_resolved",
        status: "ok",
        output: { deaths: [2, 5], death_sources: { 2: ["poison"], 5: ["wolf_kill"] } },
      },
    ],
    checkpoints: [
      {
        eventCount: events.length,
        decisionCount: 7,
        settlementCount: 7,
        complete: true,
        players: roles.map((role, i) => ({
          id: i + 1,
          role,
          camp: i < 4 ? "wolf" : "good",
          alive: ![2, 5].includes(i + 1),
          privateState: i === 11 ? { awakenedWitch: { policy, nights: [row] } } : {},
        })),
      },
    ],
    finalized: true,
  } as unknown as ReproductionRecord;
}
test("字面一次调毒全批准独立付款与夜毒闭合", () => expect(() => verify(fixture())).not.toThrow());
const cases: Record<string, (r: ReproductionRecord) => void> = {
  女巫不能看协助者交流: (r) => {
    r.decisions[0]!.request.context.visible_events.push({
      seq: 1,
      type: "brew_discussion",
      payload: structuredClone(r.events[7]!.payload),
    });
  },
  组外不能看秘密目标: (r) => {
    r.events[6]!.audience = [8, 9];
  },
  批准只本人不能全组或God: (r) => {
    r.events[8]!.audience = [];
  },
  结果不能反馈女巫: (r) => {
    r.events[9]!.audience = [12];
  },
  组通知不能附女巫身份: (r) => {
    r.events[6]!.payload.actorId = 12;
  },
  同意票不能伪造原动作: (r) => {
    (r.decisions[2]!.outcome as any).action.args.approve = false;
  },
  讨论不能改写原话: (r) => {
    r.events[7]!.payload.text = "原话";
  },
  不得省独立批准: (r) => {
    r.decisions.splice(2, 1);
  },
  不得凭空发成功: (r) => {
    r.events[9]!.payload.outcome = "vetoed";
  },
  不得把实际毒伪造成狼刀: (r) => {
    r.operations[0]!.output!.death_sources = { 2: ["wolf_kill"], 5: ["wolf_kill"] };
  },
  不得让普通守卫挡毒: (r) => {
    r.events[11]!.payload.deaths = [5];
  },
  不得退款恢复库存: (r) => {
    (r.checkpoints[0]!.players[11]!.privateState.awakenedWitch as any).nights = [];
  },
  不按机器值补全权威可用布尔: (r) => {
    r.decisions[0]!.request.context.awakened_brew_options = {
      ...r.decisions[0]!.request.context.awakened_brew_options!,
      canPoison: false,
    };
  },
  未来开窗不得付款早先事实: (r) => {
    r.decisions[0]!.openedAtEventCount = 10;
  },
  跨夜开窗不能借旧资源: (r) => {
    r.decisions[0]!.day = r.decisions[0]!.request.context.day = 2;
  },
  旧资格不能改为第二次只需一人: (r) => {
    r.events[5]!.payload.ordinal = 2;
  },
  批准不能看到当前别人的票: (r) => {
    r.decisions[2]!.request.context.visible_events.push({
      seq: 3,
      type: "brew_approval",
      payload: structuredClone(r.events[8]!.payload),
    });
  },
};
for (const [name, mutate] of Object.entries(cases))
  test(name, () => {
    const r = fixture();
    mutate(r);
    expect(() => verify(r)).toThrow("reproduction_awakened_witch_invalid");
  });
function failed(): ReproductionRecord {
  const r = fixture(),
    cp = r.checkpoints[0]!;
  r.events = r.events.slice(0, 9);
  r.operations = [];
  cp.eventCount = 9;
  cp.complete = false;
  r.termination = {
    reason: "runtime_error",
    winner: null,
    errors: [{ scope: "cycle", name: "Error" }],
  };
  for (const p of cp.players) p.alive = true;
  (cp.players[11]!.privateState.awakenedWitch as any).nights[0].outcome = "building";
  return r;
}
test("全部批准已付仍building是合法failed前缀，不自动补Poison", () =>
  expect(() => verify(failed())).not.toThrow());
test("building不能伪装完整检查点", () => {
  const r = failed();
  r.checkpoints[0]!.complete = true;
  expect(() => verify(r)).toThrow("reproduction_awakened_witch_invalid");
});
test("error已知批准候选可保已付票，不能改目标/票或当自动否决", () => {
  const r = failed(),
    d = r.decisions[2]!;
  r.events.pop();
  r.checkpoints[0]!.eventCount--;
  d.returnedCandidate = { name: "brew_approve", args: { approve: true } };
  d.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  expect(() => verify(r)).not.toThrow();
  d.returnedCandidate.args.approve = false;
  expect(() => verify(r)).toThrow("reproduction_awakened_witch_invalid");
});

test("最终building前缀必须保真实失败终态，不能仅把complete改false", () => {
  const r = failed();
  r.termination = null;
  expect(() => verify(r)).toThrow("reproduction_awakened_witch_invalid");
});

test("已发表讨论不能缩结算游标并删本人历史伪装未付", () => {
  const r = failed(),
    cp = r.checkpoints[0]!;
  r.events = r.events.slice(0, 8);
  cp.eventCount = 8;
  cp.settlementCount = 5;
  const row = (cp.players[11]!.privateState.awakenedWitch as any).nights[0];
  row.discussions = [];
  row.approvals = [];
  expect(() => verify(r)).toThrow("reproduction_awakened_witch_invalid");
});

test("批准首写后false-close仍可发表精确error票，但failedCP不能删已发表票", () => {
  const r = failed(),
    d = r.decisions[2]!,
    row = (r.checkpoints[0]!.players[11]!.privateState.awakenedWitch as any).nights[0];
  d.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  d.returnedCandidate = { name: "brew_approve", args: { approve: true } };
  expect(() => verify(r)).not.toThrow();
  row.outcome = "poison";
  expect(() => verify(r)).toThrow("reproduction_awakened_witch_invalid");
  row.outcome = "building";
  row.approvals = [];
  expect(() => verify(r)).toThrow("reproduction_awakened_witch_invalid");
});

test("刀毒复合来源按集合比较，反序同义但未知/重复原因仍拒绝", () => {
  const r = fixture();
  for (const e of r.events) if (e.type === "wolf_kill_vote_cast") e.payload.targetId = 2;
  for (const d of r.decisions)
    if (d.stage === "wolf_vote") (d.outcome as any).action.args.target_id = 2;
  r.decisions[0]!.request.context.awakened_brew_options = {
    ...r.decisions[0]!.request.context.awakened_brew_options!,
    wolfTarget: 2,
  };
  r.events[11]!.payload.deaths = [2];
  r.checkpoints[0]!.players[4]!.alive = true;
  r.operations[0]!.output = { deaths: [2], death_sources: { 2: ["poison", "wolf_kill"] } };
  expect(() => verify(r)).not.toThrow();
  r.operations[0]!.output!.death_sources = { 2: ["wolf_kill", "poison"] };
  expect(() => verify(r)).not.toThrow();
  r.operations[0]!.output!.death_sources = { 2: ["wolf_kill", "poison", "shot"] };
  expect(() => verify(r)).toThrow("reproduction_awakened_witch_invalid");
  r.operations[0]!.output!.death_sources = { 2: ["wolf_kill", "poison", "poison"] };
  expect(() => verify(r)).toThrow("reproduction_awakened_witch_invalid");
});
