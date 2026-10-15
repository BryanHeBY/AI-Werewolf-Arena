/**
 * 单元测试负责原骑士板三方独立字面因果账本。输入明确的夜刀、整周期选择、决斗及替死结果，输出严格接受／拒绝。
 * 夹具只测ledger，不冒称完整Tape；live不带logicOps和finalized必须带操作各用明确反例区分。
 */
import { expect, test } from "bun:test";
import { validateAwakenedDayRolesRecord as verify } from "../../../../src/recording/verification/awakened-day-roles/validate";
import { validateAwakenedDarkStarsRecord as legacy } from "../../../../src/recording/verification/awakened-dark-stars/validate";
import { AWAKENED_GUARD_POLICY as gp } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import { AWAKENED_DUEL_POLICY as kp } from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import { AWAKENED_BEAUTY_POLICY as bp } from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import type { ReproductionRecord } from "../../../../src/recording/reproduction/format";
const roles = [
  "villager",
  "villager",
  "witch",
  "villager",
  "awakened_guard",
  "villager",
  "awakened_knight",
  "wolf",
  "wolf",
  "awakened_wolf_beauty",
  "seer",
  "wolf",
];
type Mode = "body" | "substitute" | "none" | "good" | "blast" | "blast_vote";
function fixture(mode: Mode = "body", declines = false): ReproductionRecord {
  const events: any[] = [],
    decisions: any[] = [];
  const emit = (type: string, payload: any, audience?: number[]) =>
    events.push({
      timestamp: events.length,
      type,
      payload,
      ...(audience === undefined ? {} : { audience }),
    });
  const decide = (
    actorId: number,
    stage: string,
    name: string,
    args: any,
    phase: string,
    extra: any = {},
  ) =>
    decisions.push({
      actorId,
      day: 1,
      stage,
      openedAtEventCount: events.length,
      openedAfterSettlement: decisions.length,
      settleOrder: decisions.length + 1,
      request: {
        actorId,
        phase,
        allowedTools: [name],
        context: {
          day: 1,
          stage,
          visible_events: events
            .filter(
              (e) =>
                e.type.startsWith("awakened_") &&
                (e.audience === undefined || e.audience.includes(actorId)),
            )
            .map((e, i) => ({ seq: i + 1, type: e.type, payload: structuredClone(e.payload) })),
          action_failure_policy: "error",
          allow_fallback: false,
          turn_constraints: {},
          ...extra,
        },
      },
      outcome: { kind: "action", action: { name, args } },
    });
  const ids = Array.from({ length: 12 }, (_, i) => i + 1),
    players = ids.map((id) => ({
      id,
      role: roles[id - 1]!,
      camp: [8, 9, 10, 12].includes(id) ? "wolf" : "good",
    }));
  const config = {
    boardSize: 12,
    selfDestruct: { enabledWindows: ["on_pre_election", "on_pre_vote"] },
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    winConditions: ["slaughter_side"],
    awakenedWolfBeauty: { policy: bp },
    awakenedGuard: { policy: gp },
    awakenedKnight: { policy: kp },
    witch: {
      canSelfHeal: "disabled",
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    voting: { exilePolicy: "awa_one_pk_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
  };
  let b: any = { policy: bp, choices: [], replacement: null },
    g: any = { policy: gp, cycles: [] },
    k: any = { policy: kp, attempts: [] };
  const dead: number[] = [];
  const cp = (complete: boolean) => ({
    complete,
    eventCount: events.length,
    decisionCount: decisions.length,
    settlementCount: decisions.length,
    snapshot: { day: 1, phase: events.length ? "day" : "night" },
    players: players.map((p) => ({
      ...p,
      alive: !dead.includes(p.id),
      privateState:
        p.id === 10
          ? { awakenedBeauty: structuredClone(b) }
          : p.id === 5
            ? { awakenedGuard: structuredClone(g) }
            : p.id === 7
              ? { awakenedKnight: structuredClone(k) }
              : {},
    })),
  });
  const initial = cp(true);
  emit("phase_changed", { day: 1, phase: "night" });
  emit("awakened_guard_cycle_started", { policy: gp, day: 1, actorId: 5 }, [5]);
  g.cycles.push({ day: 1, status: "open" });
  decide(
    5,
    "awakened_protection_night",
    "awakened_protect",
    { mode: "wait", target_id: null },
    "night",
    { awakened_protect_options: { timing: "night", last: false, targetIds: ids } },
  );
  emit(
    "awakened_protection_chosen",
    {
      policy: gp,
      day: 1,
      actorId: 5,
      timing: "night",
      mode: "wait",
      targetId: null,
      outcome: "wait",
    },
    [5],
  );
  for (const actorId of [8, 9, 10, 12]) {
    decide(actorId, "wolf_vote", "kill_vote", { target_id: 1, abstain: false }, "night");
    emit("wolf_kill_vote_cast", { actorId, targetId: 1, abstain: false }, [8, 9, 10, 12]);
  }
  decide(10, "awakened_charm", "awakened_charm", { target_id: 2 }, "night", {
    awakened_charm_candidates: ids.filter((id) => id !== 10),
  });
  emit(
    "awakened_charm_chosen",
    { policy: bp, day: 1, actorId: 10, targetId: 2, nextAllowedNight: 3 },
    [10],
  );
  b.choices.push({ day: 1, targetId: 2 });
  decide(3, "witch", "use_potion", { target_id: 3, potion_type: "none" }, "night");
  emit("witch_potion_skipped", { actorId: 3, potionType: "none" });
  const opAt = events.length;
  emit("phase_changed", { day: 1, phase: "day" });
  emit("night_resolved", { deaths: [1] });
  dead.push(1);
  const target =
    mode === "body"
      ? 10
      : mode === "substitute"
        ? 2
        : mode === "good"
          ? 7
          : mode === "blast" || mode === "blast_vote"
            ? 8
            : null;
  decide(
    5,
    "awakened_protection_day",
    "awakened_protect",
    { mode: target === null ? "pass" : "protect", target_id: target },
    "day",
    {
      awakened_protect_options: {
        timing: "day",
        last: false,
        targetIds: ids.filter((id) => id !== 1),
      },
    },
  );
  emit(
    "awakened_protection_chosen",
    {
      policy: gp,
      day: 1,
      actorId: 5,
      timing: "day",
      mode: target === null ? "pass" : "protect",
      targetId: target,
      outcome: target === null ? "passed" : "protected",
    },
    [5],
  );
  g.cycles = [
    target === null
      ? { day: 1, status: "passed" }
      : { day: 1, status: "protected", targetId: target, timing: "day" },
  ];
  if (target !== null)
    emit("awakened_protection_revealed", { policy: gp, day: 1, actorId: 5, targetId: target });
  const block = (id: number, cause: string) => {
    emit(
      "awakened_protection_block_detail",
      {
        policy: gp,
        day: 1,
        actorId: 5,
        targetId: id,
        phase: mode === "blast_vote" ? "voting" : "day",
        rootPhase: mode === "blast_vote" ? "voting" : "day",
        causes: [cause],
      },
      [],
    );
    emit("awakened_protection_blocked", { policy: gp, day: 1, targetId: id });
  };
  if (mode === "blast" || mode === "blast_vote") {
    const window = mode === "blast_vote" ? "on_pre_vote" : "on_pre_election",
      currentPhase = mode === "blast_vote" ? "voting" : "day";
    if (mode === "blast_vote") emit("phase_changed", { day: 1, phase: "voting" });
    decide(8, window, "self_destruct", { confirm: true, reason: "Literal" }, currentPhase);
    emit("awakened_self_destruct_declared", {
      policy: gp,
      day: 1,
      actorId: 8,
      window,
    });
    block(8, "self_destruct");
    emit("awakened_self_destruct_resolved", {
      policy: gp,
      day: 1,
      actorId: 8,
      window,
      deaths: [],
    });
  } else {
    if (declines) {
      for (let n = 0; n < 2; n++) {
        decide(7, "awakened_duel", "awakened_duel", { target_id: null }, "day", {
          awakened_duel_options: {
            continuing: false,
            targetIds: ids.filter((id) => id !== 1 && id !== 7),
          },
        });
        emit("day_speech", { actorId: 4, text: "Next explicit boundary" });
      }
    }
    const duelTarget = mode === "good" ? 6 : 10,
      branch = mode === "good" ? "good" : "wolf";
    decide(7, "awakened_duel", "awakened_duel", { target_id: duelTarget }, "day", {
      awakened_duel_options: {
        continuing: false,
        targetIds: ids.filter((id) => id !== 1 && id !== 7),
      },
    });
    emit("awakened_duel_committed", {
      policy: kp,
      day: 1,
      actorId: 7,
      chain: 1,
      targetId: duelTarget,
      branch,
    });
    k.attempts.push({ day: 1, chain: 1, targetId: duelTarget, branch });
    let actual: number[] = [];
    if (mode === "body") block(10, "awakened_duel");
    else if (mode === "good") {
      block(7, "awakened_duel");
      actual = [6];
    } else {
      b.replacement = {
        day: 1,
        targetId: 2,
        phase: "day",
        rootPhase: "day",
        preventedCauses: ["awakened_duel"],
      };
      emit("awakened_beauty_replacement_paid", { policy: bp, actorId: 10, ...b.replacement }, []);
      if (mode === "substitute") block(2, "awakened_beauty_replacement");
      else actual = [2];
    }
    emit("awakened_duel_resolved", {
      policy: kp,
      day: 1,
      actorId: 7,
      chain: 1,
      targetId: duelTarget,
      deaths: actual,
    });
    dead.push(...actual);
    if (mode === "none") emit("additional_deaths", { deaths: [2] });
    if (mode === "none" || mode === "substitute")
      emit("awakened_beauty_replaced", {
        policy: bp,
        day: 1,
        actorId: 10,
        targetId: 2,
        targetDied: mode === "none",
      });
    if (mode !== "good")
      decide(7, "awakened_duel_continue", "awakened_duel", { target_id: null }, "day", {
        awakened_duel_options: {
          continuing: true,
          targetIds: ids.filter((id) => !dead.includes(id) && id !== 7 && id !== duelTarget),
        },
      });
    for (const id of actual) {
      emit("last_words_granted", { day: 1, phase: "day", playerId: id });
      decide(id, "last_words", "speak", { text: "Deferred literal words" }, "day", {
        trigger: "last_words",
        death_phase: "day",
        death_action_id: id,
      });
      emit("last_words_spoken", {
        day: 1,
        phase: "day",
        playerId: id,
        text: "Deferred literal words",
      });
    }
    emit("awakened_duel_chain_ended", {
      policy: kp,
      day: 1,
      actorId: 7,
      chain: 1,
      reason: mode === "good" ? "miss" : "ended",
    });
  }
  emit("awakened_protection_expired", { policy: gp, day: 1, actorId: 5 }, []);
  return {
    metadata: { normalizedBoard: config, players },
    events,
    decisions,
    operations: [
      {
        scope: "resolution",
        op: "night_damage_resolved",
        event_count: opAt,
        output: { deaths: [1], death_sources: { "1": ["wolf_kill"] } },
      },
    ],
    checkpoints: [initial, cp(true)],
    finalized: true,
  } as unknown as ReproductionRecord;
}
for (const mode of ["body", "substitute", "none", "good", "blast", "blast_vote"] as const)
  test(`独立原板实际结果/${mode}`, () => {
    expect(() => verify(fixture(mode))).not.toThrow();
    expect(() => legacy(fixture(mode))).not.toThrow();
  });
test("live缺operation可由动作重建，finalized缺operation拒绝", () => {
  const r = fixture();
  r.operations = [];
  r.finalized = false;
  expect(() => verify(r)).not.toThrow();
  r.finalized = true;
  expect(() => verify(r)).toThrow("reproduction_awakened_day_roles_invalid");
});
for (const [name, mutate] of [
  [
    "盾不应耗替死",
    (r: any) =>
      (r.events.find((e: any) => e.type === "awakened_duel_resolved").payload.deaths = [10]),
  ],
  [
    "替身盾不能伪造未付替死",
    (r: any) =>
      (r.events.find((e: any) => e.type === "awakened_protection_block_detail").payload.causes = [
        "awakened_beauty_replacement",
      ]),
  ],
  [
    "Wolf分支不能伪造Good",
    (r: any) =>
      (r.events.find((e: any) => e.type === "awakened_duel_committed").payload.branch = "good"),
  ],
  [
    "God阻挡不能给玩家",
    (r: any) =>
      (r.events.find((e: any) => e.type === "awakened_protection_block_detail").audience = [5]),
  ],
  [
    "失败不能退款已发表盾",
    (r: any) => {
      const c = r.checkpoints.at(-1);
      c.complete = false;
      c.players.find((p: any) => p.id === 5).privateState.awakenedGuard.cycles[0] = {
        day: 1,
        status: "open",
      };
    },
  ],
  ["实际名单不是原提案", (r: any) => (r.operations[0].output.deaths = [10])],
  ["缺Guard flag不跳审", (r: any) => delete r.metadata.normalizedBoard.awakenedGuard],
  [
    "伪造巡猎混板拒绝",
    (r: any) =>
      (r.metadata.normalizedBoard.awakenedHunter = { policy: "awa_directional_patrol_v1" }),
  ],
  [
    "第二窗不能在首结算前",
    (r: any) => {
      const d = r.decisions.find((d: any) => d.stage === "awakened_duel_continue");
      d.openedAtEventCount = r.events.findIndex((e: any) => e.type === "awakened_duel_resolved");
    },
  ],
  [
    "无骑士flag不能藏工具",
    (r: any) => {
      delete r.metadata.normalizedBoard.awakenedGuard;
      delete r.metadata.normalizedBoard.awakenedKnight;
    },
  ],
] as const)
  test(name, () => {
    const r = fixture();
    mutate(r);
    expect(() => verify(r)).toThrow("reproduction_awakened_day_roles_invalid");
  });

test("普通null不消费，多个真实边界后非空只绑定精确付款候选", () => {
  expect(() => verify(fixture("body", true))).not.toThrow();
});
