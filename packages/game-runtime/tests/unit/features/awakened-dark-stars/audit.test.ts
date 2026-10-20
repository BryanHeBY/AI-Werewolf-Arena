/**
 * 单元测试负责原暗夜星辰独立因果账本的字面三方预期与篡改拒绝。输入手写刀毒/替死/方向链，输出真实原提案到实际死亡的绑定。
 * 这里是机制ledger单元，不伪称完整Tape正例；真实parser、录制与同构建执行由后续原板整局协议验证。
 */
import { expect, test } from "bun:test";
import { validateAwakenedDarkStarsRecord as verify } from "../../../../src/recording/verification/awakened-dark-stars/validate";
import { AWAKENED_BEAUTY_POLICY as bp } from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import { AWAKENED_PATROL_POLICY as pp } from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import type { ReproductionRecord } from "../../../../src/recording/reproduction/format";
type Mode = "patrol_night" | "patrol_day" | "exile_beauty";
const roles = [
  "wolf",
  "wolf",
  "awakened_wolf_beauty",
  "villager",
  "villager",
  "villager",
  "seer",
  "witch",
  "guard",
  "awakened_hunter",
];
function fixture(mode: Mode): ReproductionRecord {
  const events: any[] = [],
    decisions: any[] = [];
  const emit = (type: string, payload: object, audience?: number[]) =>
    events.push({
      timestamp: events.length,
      type,
      payload,
      ...(audience === undefined ? {} : { audience }),
    });
  const decide = (
    actorId: number,
    stage: string,
    tool: string,
    args: object,
    phase: string,
    extra: object = {},
  ) => {
    const cursor = events.length;
    decisions.push({
      actorId,
      day: 1,
      stage,
      openedAtEventCount: cursor,
      openedAfterSettlement: decisions.length,
      settleOrder: decisions.length + 1,
      request: {
        actorId,
        phase,
        allowedTools: [tool],
        context: {
          day: 1,
          stage,
          visible_events: events
            .slice(0, cursor)
            .filter(
              (e) =>
                (e.type.startsWith("awakened_charm") ||
                  e.type.startsWith("awakened_beauty") ||
                  e.type.startsWith("awakened_patrol")) &&
                (e.audience === undefined || e.audience.includes(actorId)),
            )
            .map((e, i) => ({ seq: i + 1, type: e.type, payload: structuredClone(e.payload) })),
          turn_constraints: {},
          action_failure_policy: "error",
          allow_fallback: false,
          ...extra,
        },
      },
      outcome: { kind: "action", action: { name: tool, args } },
    });
  };
  emit("phase_changed", { phase: "night", day: 1 });
  for (const actorId of [1, 2, 3]) {
    decide(actorId, "wolf_vote", "kill_vote", { target_id: 4, abstain: false }, "night");
    emit("wolf_kill_vote_cast", { actorId, targetId: 4, abstain: false }, [1, 2, 3]);
  }
  decide(9, "guard", "guard", { target_id: null, abstain: true }, "night");
  emit("guard_applied", { actorId: 9, targetId: null });
  decide(3, "awakened_charm", "awakened_charm", { target_id: 5 }, "night", {
    awakened_charm_candidates: [1, 2, 4, 5, 6, 7, 8, 9, 10],
  });
  emit(
    "awakened_charm_chosen",
    { policy: bp, day: 1, actorId: 3, targetId: 5, nextAllowedNight: 3 },
    [3],
  );
  decide(
    8,
    "witch",
    "use_potion",
    {
      target_id: mode === "patrol_night" ? 10 : 8,
      potion_type: mode === "patrol_night" ? "poison" : "none",
    },
    "night",
  );
  emit(mode === "patrol_night" ? "witch_potion_used" : "witch_potion_skipped", {
    actorId: 8,
    targetId: mode === "patrol_night" ? 10 : null,
    potionType: mode === "patrol_night" ? "poison" : "none",
  });
  const opCursor = events.length;
  emit("phase_changed", { phase: "day", day: 1 });
  emit("night_resolved", { deaths: mode === "patrol_night" ? [4, 10] : [4] });
  if (mode !== "patrol_night") {
    emit("phase_changed", { phase: "voting", day: 1 });
    emit("vote_summary", { votes: [], tally: {}, target: mode === "exile_beauty" ? 3 : 10 });
  }
  let replacement: any = null,
    payment: any = null;
  if (mode !== "exile_beauty") {
    if (mode === "patrol_day") emit("voted_out", { target: 10 });
    const root = mode === "patrol_night" ? "night" : "voting",
      phase = mode === "patrol_night" ? "day" : "voting";
    decide(10, "awakened_patrol", "patrol", { direction: "counter_clockwise" }, phase, {
      patrol_seat_order: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      trigger: "on_death",
      death_phase: root,
      death_origin_phase: root,
      death_sources: [mode === "patrol_night" ? "poison" : "exile"],
      death_action_id: 1,
    });
    payment = { day: 1, rootPhase: root, direction: "counter_clockwise", targetId: 3 };
    emit("awakened_patrol_paid", { policy: pp, actorId: 10, ...payment }, [10]);
  }
  if (mode !== "patrol_night") {
    replacement = {
      day: 1,
      phase: "voting",
      rootPhase: "voting",
      targetId: 5,
      preventedCauses: [mode === "patrol_day" ? "awakened_patrol" : "exile"],
    };
    emit("awakened_beauty_replacement_paid", { policy: bp, actorId: 3, ...replacement }, []);
    emit("additional_deaths", { deaths: [5] });
    emit("awakened_beauty_replaced", {
      policy: bp,
      day: 1,
      actorId: 3,
      targetId: 5,
      targetDied: true,
    });
  } else emit("additional_deaths", { deaths: [3] });
  if (mode !== "exile_beauty")
    emit("awakened_patrol_resolved", {
      policy: pp,
      day: 1,
      actorId: 10,
      direction: "counter_clockwise",
      targetId: mode === "patrol_night" ? 3 : 5,
    });
  const dead = mode === "patrol_night" ? [3, 4, 10] : mode === "patrol_day" ? [4, 5, 10] : [4, 5];
  return {
    schemaVersion: 3,
    finalized: true,
    metadata: {
      normalizedBoard: {
        boardSize: 10,
        enableSheriff: false,
        roleSetups: [
          { role: "wolf", count: 2 },
          { role: "awakened_wolf_beauty", count: 1 },
          { role: "villager", count: 3 },
          { role: "seer", count: 1 },
          { role: "witch", count: 1 },
          { role: "guard", count: 1 },
          { role: "awakened_hunter", count: 1 },
        ],
        awakenedWolfBeauty: { policy: bp },
        awakenedHunter: { policy: pp },
        guard: { repeatPolicy: "awa_last_action_v1" },
        witch: { canSelfHeal: "disabled" },
        winConditions: ["slaughter_side"],
        voting: { exilePolicy: "awa_one_pk_v1" },
        lastWords: { policy: "awa_initial_wave_v1" },
        disclosure: { deathRevealPolicy: "awa_hidden_v1" },
      },
      players: roles.map((role, i) => ({ id: i + 1, role, camp: i < 3 ? "wolf" : "good" })),
    },
    events,
    decisions,
    operations: [
      {
        scope: "resolution",
        op: "night_damage_resolved",
        status: "ok",
        event_count: opCursor,
        output: {
          deaths: mode === "patrol_night" ? [4, 10] : [4],
          death_sources:
            mode === "patrol_night" ? { 4: ["wolf_kill"], 10: ["poison"] } : { 4: ["wolf_kill"] },
        },
      },
    ],
    checkpoints: [
      {
        complete: true,
        eventCount: events.length,
        decisionCount: decisions.length,
        settlementCount: decisions.length,
        players: roles.map((role, i) => ({
          id: i + 1,
          role,
          camp: i < 3 ? "wolf" : "good",
          alive: !dead.includes(i + 1),
          privateState:
            i === 2
              ? { awakenedBeauty: { policy: bp, choices: [{ day: 1, targetId: 5 }], replacement } }
              : i === 9
                ? { awakenedPatrol: { policy: pp, payment } }
                : {},
        })),
      },
    ],
    termination: { reason: "fixture", winner: null, errors: [] },
  } as unknown as ReproductionRecord;
}
for (const mode of ["patrol_night", "patrol_day", "exile_beauty"] as const)
  test(`原提案、根阶段与实际死亡闭合/${mode}`, () =>
    expect(() => verify(fixture(mode))).not.toThrow());
function mutate(name: string, mode: Mode, fn: (r: any) => void) {
  test(name, () => {
    const r = fixture(mode);
    fn(r);
    expect(() => verify(r)).toThrow("reproduction_awakened_dark_stars_invalid");
  });
}
mutate("拒God替死原原因从巡猎伪成放逐", "patrol_day", (r) => {
  r.events.find((e: any) => e.type === "awakened_beauty_replacement_paid").payload.preventedCauses =
    ["exile"];
});
mutate("拒巡猎绕过最近真狼", "patrol_night", (r) => {
  r.events.find((e: any) => e.type === "awakened_patrol_paid").payload.targetId = 1;
});
mutate("拒Night根伪成日根以启动替死", "patrol_night", (r) => {
  r.events.find((e: any) => e.type === "awakened_patrol_paid").payload.rootPhase = "voting";
});
mutate("拒公开结果自行冒充物理死亡", "exile_beauty", (r) => {
  r.events = r.events.filter((e: any) => e.type !== "additional_deaths");
});
mutate("拒原夜伤op丢毒后仍公告猎人毒死", "patrol_night", (r) => {
  r.operations[0].output = { deaths: [4], death_sources: { 4: ["wolf_kill"] } };
});
mutate("拒错误目标的替死库存", "exile_beauty", (r) => {
  r.checkpoints[0].players[2].privateState.awakenedBeauty.replacement.targetId = 6;
});
mutate("拒已发表付款从CP退款", "patrol_day", (r) => {
  r.checkpoints[0].players[9].privateState.awakenedPatrol.payment = null;
});
mutate("拒缩计数游标绕过付款前缀", "patrol_day", (r) => {
  r.checkpoints[0].decisionCount = 0;
  r.checkpoints[0].settlementCount = 0;
});
mutate("拒给狼队友泄魅惑目标", "patrol_day", (r) => {
  r.decisions
    .find((d: any) => d.stage === "awakened_patrol")
    .request.context.visible_events.push({
      seq: 9,
      type: "awakened_charm_chosen",
      payload: structuredClone(
        r.events.find((e: any) => e.type === "awakened_charm_chosen").payload,
      ),
    });
});
mutate("拒N1巡猎请求跨到N2开窗", "patrol_day", (r) => {
  const d = r.decisions.find((d: any) => d.stage === "awakened_patrol");
  d.day = 2;
  d.request.context.day = 2;
});
mutate("拒高级混板借角色名册启用", "patrol_day", (r) => {
  r.metadata.normalizedBoard.awakenedGuard = { policy: "awa_whole_day_guard_v1" };
});
test("失败error候选发表前缀保已付选择；不借pending假shape", () => {
  const r: any = fixture("exile_beauty"),
    at = r.events.findIndex((e: any) => e.type === "awakened_charm_chosen"),
    d = r.decisions.find((d: any) => d.stage === "awakened_charm");
  r.events = r.events.slice(0, at + 1);
  r.decisions = r.decisions.slice(0, r.decisions.indexOf(d) + 1);
  d.returnedCandidate = d.outcome.action;
  d.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  r.operations = [];
  r.termination.errors = [{ scope: "cycle", name: "Error" }];
  const cp = r.checkpoints[0];
  cp.complete = false;
  cp.eventCount = r.events.length;
  cp.decisionCount = r.decisions.length;
  cp.settlementCount = r.decisions.length;
  cp.players.forEach((p: any) => (p.alive = true));
  cp.players[2].privateState.awakenedBeauty.replacement = null;
  expect(() => verify(r)).not.toThrow();
  const forged = structuredClone(r);
  forged.checkpoints[0].players[2].privateState.awakenedBeauty.choices[0].targetId = 6;
  expect(() => verify(forged)).toThrow();
  const complete = structuredClone(r);
  complete.checkpoints[0].complete = true;
  expect(() => verify(complete)).toThrow();
});
function nightBeauty(): ReproductionRecord {
  const r: any = fixture("exile_beauty");
  r.events = r.events.slice(0, r.events.findIndex((e: any) => e.type === "night_resolved") + 1);
  for (const actor of [1, 2]) {
    r.events.find(
      (e: any) => e.type === "wolf_kill_vote_cast" && e.payload.actorId === actor,
    ).payload.targetId = 3;
    r.decisions.find(
      (d: any) => d.stage === "wolf_vote" && d.actorId === actor,
    ).outcome.action.args.target_id = 3;
  }
  const witch = r.events.find((e: any) => e.type === "witch_potion_skipped");
  witch.type = "witch_potion_used";
  witch.payload.potionType = "poison";
  witch.payload.targetId = 3;
  const d = r.decisions.find((d: any) => d.stage === "witch");
  d.outcome.action.args = { target_id: 3, potion_type: "poison" };
  const paid = {
    day: 1,
    phase: "day",
    rootPhase: "night",
    targetId: 5,
    preventedCauses: ["poison", "wolf_kill"],
  };
  r.events.splice(r.events.length - 1, 0, {
    timestamp: 8,
    type: "awakened_beauty_replacement_paid",
    payload: { policy: bp, actorId: 3, ...paid },
    audience: [],
  });
  r.events.at(-1).payload.deaths = [5];
  r.operations[0].output = { deaths: [3], death_sources: { 3: ["wolf_kill", "poison"] } };
  const cp = r.checkpoints[0];
  cp.eventCount = r.events.length;
  cp.players.forEach((p: any) => (p.alive = p.id !== 5));
  cp.players[2].privateState.awakenedBeauty.replacement = paid;
  return r;
}
test("刀毒原始提案只付一次，实际夜死由替身桥接且无公开身份", () =>
  expect(() => verify(nightBeauty())).not.toThrow());
test("不能把本应自动替死的原Beauty直接标死并省God付款", () => {
  const r: any = nightBeauty();
  r.events = r.events.filter((e: any) => e.type !== "awakened_beauty_replacement_paid");
  r.events.at(-1).payload.deaths = [3];
  const cp = r.checkpoints[0];
  cp.eventCount = r.events.length;
  cp.players.forEach((p: any) => (p.alive = p.id !== 3));
  cp.players[2].privateState.awakenedBeauty.replacement = null;
  expect(() => verify(r)).toThrow("reproduction_awakened_dark_stars_invalid");
});
test("同波本来独立中毒的目标不能作为替身", () => {
  const r: any = nightBeauty();
  const witch = r.events.find((e: any) => e.type === "witch_potion_used");
  witch.payload.targetId = 5;
  r.decisions.find((d: any) => d.stage === "witch").outcome.action.args.target_id = 5;
  r.operations[0].output = { deaths: [3, 5], death_sources: { 3: ["wolf_kill"], 5: ["poison"] } };
  const paid = r.events.find((e: any) => e.type === "awakened_beauty_replacement_paid");
  paid.payload.preventedCauses = ["wolf_kill"];
  r.checkpoints[0].players[2].privateState.awakenedBeauty.replacement.preventedCauses = [
    "wolf_kill",
  ];
  expect(() => verify(r)).toThrow("reproduction_awakened_dark_stars_invalid");
});
test("真实error候选可为非法动作但零付款，不把失败伪装成功或拒存失败档", () => {
  const r: any = fixture("exile_beauty"),
    at = r.events.findIndex((e: any) => e.type === "awakened_charm_chosen"),
    d = r.decisions.find((d: any) => d.stage === "awakened_charm");
  r.events = r.events.slice(0, at);
  r.decisions = r.decisions.slice(0, r.decisions.indexOf(d) + 1);
  d.returnedCandidate = { name: "speak", args: { text: "wrong tool" } };
  d.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  r.operations = [];
  r.termination.errors = [{ scope: "cycle", name: "Error" }];
  const cp = r.checkpoints[0];
  cp.complete = false;
  cp.eventCount = r.events.length;
  cp.decisionCount = r.decisions.length;
  cp.settlementCount = r.decisions.length;
  cp.players.forEach((p: any) => (p.alive = true));
  cp.players[2].privateState.awakenedBeauty = { policy: bp, choices: [], replacement: null };
  expect(() => verify(r)).not.toThrow();
  cp.players[2].privateState.awakenedBeauty.choices = [{ day: 1, targetId: 5 }];
  expect(() => verify(r)).toThrow();
});
test("失败CP计数不能引用尚未开窗的未来付费决定", () => {
  const r: any = fixture("exile_beauty"),
    cp = r.checkpoints[0];
  cp.complete = false;
  cp.eventCount = 0;
  cp.players.forEach((p: any) => (p.alive = true));
  cp.players[2].privateState.awakenedBeauty.replacement = null;
  r.termination.errors = [{ scope: "cycle", name: "Error" }];
  expect(() => verify(r)).toThrow("reproduction_awakened_dark_stars_invalid");
});
