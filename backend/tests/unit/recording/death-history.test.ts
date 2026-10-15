/**
 * 负责普通死亡历史独立单元测试；输入和接受／拒绝均为手写纯 Tape 数据，不实例化 World 或调用生产 DR。
 * 预期来自冻结来源政策、明确请求／事实／徽字段写序；覆盖混合源、阶段、partial／opaque、多个窗口与同一许可的重试。
 * 玩家原生命、原组件引用、精确 every-await 位置没有录制，不通过假 handle 或生产输出生成 oracle。
 * 仅测试独立 verifier，不代表公开 reader 已强化或 exact replay／全部规则矩阵已完成。
 */
import { expect, test } from "bun:test";
import {
  Camp,
  DeathCause,
  Phase,
  Role,
  WinCondition,
  type HunterDeathActionPolicy,
  type ToolCall,
} from "@ai-werewolf-arena/game-contract";
import type {
  RecordedCheckpoint,
  RecordedDecision,
  ReproductionRecord,
} from "../../../src/recording/reproduction/format";
import { validateDeathHistoryRecord } from "../../../src/recording/verification/death-history/validate";

const error = "reproduction_death_history_invalid";
function literal(): ReproductionRecord {
  const roles = [Role.Hunter, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Villager];
  const people = roles.map((role, i) => ({
    id: i + 1,
    name: `P${i + 1}`,
    role,
    camp: role === Role.Wolf ? Camp.Wolf : Camp.Good,
  }));
  return {
    schemaVersion: 2,
    finalized: false,
    metadata: {
      engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
      random: {
        seed: "literal-neutral-death-audit",
        algorithm: "mulberry32-fnv1a-utf16-v1",
        streamPolicy: "named-path-v1",
        path: [],
      },
      ruleset: { id: "awa_classic", version: "1.0.0" },
      boardId: "literal_death_history",
      locale: "zh-CN",
      maxDays: 3,
      dealMode: "fixed",
      normalizedBoard: {
        boardSize: 6,
        enableSheriff: false,
        winConditions: [WinCondition.SlaughterCity],
        hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
        roleSetups: [
          { role: Role.Hunter, count: 1 },
          { role: Role.Wolf, count: 2 },
          { role: Role.Villager, count: 3 },
        ],
      },
      players: people,
    },
    checkpoints: [
      {
        cycle: 0,
        complete: true,
        eventCount: 0,
        snapshot: { day: 1, phase: Phase.Night, gameOver: false, result: null },
        players: people.map((p) => ({
          ...p,
          seat: p.id,
          alive: true,
          privateState: p.role === Role.Hunter ? { hunter: { canShoot: true } } : {},
          victory: { affiliations: [{ kind: "faction", faction: p.camp }] },
          vote: { canVote: true, weight: 1 },
          badge: { isSheriff: false, destroyed: false, voteWeight: 1.5 },
          marks: [],
        })),
      },
    ],
    decisions: [],
    events: [],
    operations: [],
    termination: null,
  };
}
function checkpoint(record: ReproductionRecord, complete = true): RecordedCheckpoint {
  const cp = structuredClone(record.checkpoints.at(-1)!);
  cp.cycle = record.checkpoints.length;
  cp.eventCount = record.events.length;
  cp.complete = complete;
  cp.snapshot = { day: 1, phase: Phase.Day, gameOver: false, result: null };
  if (!complete) cp.failure = { name: "Error", code: "cycle_failed" };
  else delete cp.failure;
  record.checkpoints.push(cp);
  return cp;
}
function event(record: ReproductionRecord, type: string, payload: Record<string, unknown>) {
  record.events.push({ timestamp: record.events.length + 1, type, payload });
}
function request(
  actorId: number,
  stage: RecordedDecision["stage"],
  action: ToolCall | null,
  permit = 1,
): RecordedDecision {
  const tool =
    stage === "last_words"
      ? "speak"
      : stage === "sheriff_badge_choice"
        ? "choose_badge_successor"
        : "shoot";
  return {
    actorId,
    day: 1,
    stage,
    turn: 1,
    openedAfterSettlement: 0,
    settleOrder: 1,
    request: {
      actorId,
      phase: Phase.Day,
      allowedTools: [tool],
      context: {
        day: 1,
        stage,
        visible_events: [],
        turn_constraints: {
          min_valid_actions: 1,
          max_valid_actions: 1,
          required_any_tools: [tool],
        },
        death_action_id: permit,
        ...(stage === "last_words"
          ? { trigger: "last_words", death_phase: Phase.Night }
          : stage === "sheriff_badge_choice"
            ? { trigger: "badge_handoff", badge_candidates: [2, 3, 4, 5, 6] }
            : { trigger: "on_death", death_phase: Phase.Night }),
      },
    },
    outcome: { kind: "action", action },
  };
}
function night(record: ReproductionRecord, id: number, sources: DeathCause[], day = 1) {
  event(record, "phase_changed", { phase: Phase.Day, day });
  record.operations.push({
    scope: "resolution",
    op: "night_damage_resolved",
    phase: Phase.Night,
    status: "ok",
    output: { deaths: [id], death_sources: { [id]: sources } },
  });
  event(record, "night_resolved", { deaths: [id] });
}
function shot(
  source: DeathCause[],
  policy: HunterDeathActionPolicy = "awa_qualified_sources_v1",
  origin: Phase | undefined = undefined,
) {
  const record = literal();
  record.metadata.normalizedBoard.hunter = { deathActionPolicy: policy };
  night(record, 1, source);
  const d = request(1, "hunter_shot", { name: "shoot", args: { target_id: 4 } });
  d.request.context.death_sources = source;
  if (origin !== undefined) d.request.context.death_origin_phase = origin;
  record.decisions.push(d);
  event(record, "hunter_shot", { hunterId: 1, targetId: 4 });
  const cp = checkpoint(record);
  cp.players[0]!.alive = false;
  cp.players[3]!.alive = false;
  cp.players[0]!.privateState.hunter = { canShoot: false };
  return record;
}
const accepts = (record: ReproductionRecord) =>
  expect(() => validateDeathHistoryRecord(record)).not.toThrow();
const rejects = (record: ReproductionRecord) =>
  expect(() => validateDeathHistoryRecord(record)).toThrow(error);

test("ordinary gun policy checks the whole source set, configured native origin and distinct learned or gifted policy", () => {
  for (const source of [
    DeathCause.WolfKill,
    DeathCause.MechanicalKnife,
    DeathCause.AwakenedHiddenKnife,
    DeathCause.Exile,
    DeathCause.Shot,
    DeathCause.WhiteWolfBlast,
  ])
    accepts(shot([source]));
  for (const source of [
    DeathCause.Dream,
    DeathCause.Lovers,
    DeathCause.Poison,
    DeathCause.Charm,
    DeathCause.Duel,
    DeathCause.FragrantLink,
  ]) {
    rejects(shot([source]));
    rejects(shot([DeathCause.WolfKill, source]));
  }
  rejects(shot([]));
  rejects(shot([DeathCause.Shot], "awa_knife_or_exile_v1"));
  const dayKing = shot([DeathCause.WolfKill]);
  dayKing.metadata.players[0]!.role = Role.WolfKing;
  for (const cp of dayKing.checkpoints) cp.players[0]!.role = Role.WolfKing;
  dayKing.metadata.normalizedBoard.wolfKing = { deathActionPolicy: "awa_day_deaths_v1" };
  dayKing.decisions[0]!.stage = "death_shot";
  dayKing.decisions[0]!.request.context.stage = "death_shot";
  dayKing.events[2] = {
    timestamp: 3,
    type: "wolf_king_shot",
    payload: { actorId: 1, targetId: 4 },
  };
  dayKing.decisions[0]!.request.context.death_origin_phase = Phase.Night;
  rejects(dayKing);
  const daytime = structuredClone(dayKing);
  daytime.events = [
    { timestamp: 1, type: "phase_changed", payload: { phase: Phase.Voting, day: 1 } },
    { timestamp: 2, type: "voted_out", payload: { target: 1 } },
    daytime.events[2]!,
  ];
  daytime.decisions[0]!.request.context.death_origin_phase = Phase.Voting;
  daytime.decisions[0]!.request.context.death_sources = [DeathCause.Exile];
  daytime.decisions[0]!.request.phase = Phase.Voting;
  daytime.decisions[0]!.request.context.death_phase = Phase.Voting;
  daytime.checkpoints[1]!.snapshot.phase = Phase.Voting;
  accepts(daytime);
  const gift = shot([DeathCause.Shot], "awa_knife_or_exile_v1");
  gift.decisions[0]!.stage = "death_shot";
  gift.decisions[0]!.request.context.stage = "death_shot";
  gift.decisions[0]!.request.context.ability_id = "gift:literal:1";
  gift.events[2] = { timestamp: 3, type: "player_shot", payload: { actorId: 1, targetId: 4 } };
  accepts(gift);
  const learned = structuredClone(gift);
  delete learned.decisions[0]!.request.context.ability_id;
  learned.metadata.players[0]!.role = Role.MechanicalWolf;
  for (const cp of learned.checkpoints) cp.players[0]!.role = Role.MechanicalWolf;
  learned.events[2]!.type = "mechanical_shot";
  accepts(learned);
});

test("gun attempt groups cannot reuse an old candidate or one permit for two facts; opaque, pass, blocked and late replacement stay distinct", () => {
  const record = shot([DeathCause.WolfKill]);
  const late = structuredClone(record.decisions[0]!);
  late.turn = 2;
  late.outcome = { kind: "action", action: { name: "shoot", args: { target_id: 5 } } };
  record.decisions.push(late);
  rejects(record);
  late.outcome = { kind: "action", action: null };
  rejects(record);
  late.outcome = { kind: "error", name: "Error", code: "decision_failed" };
  accepts(record);
  const duplicate = shot([DeathCause.WolfKill]);
  event(duplicate, "hunter_shot", { hunterId: 1, targetId: 4 });
  duplicate.checkpoints[1]!.eventCount++;
  rejects(duplicate);
  const twoStocks = structuredClone(duplicate),
    second = structuredClone(twoStocks.decisions[0]!);
  second.request.context.death_action_id = 2;
  second.request.context.ability_id = "gift:literal:second";
  second.stage = "death_shot";
  second.request.context.stage = "death_shot";
  second.settleOrder = 2;
  twoStocks.decisions.push(second);
  twoStocks.events[3]!.type = "player_shot";
  twoStocks.events[3]!.payload = { actorId: 1, targetId: 4 };
  accepts(twoStocks);
  const pass = shot([DeathCause.Exile]);
  pass.decisions[0]!.outcome = {
    kind: "action",
    action: { name: "shoot", args: { target_id: null } },
  };
  pass.events.pop();
  pass.checkpoints[1]!.eventCount--;
  accepts(pass);
  const blocked = shot([DeathCause.WolfKill]);
  blocked.events[2]!.type = "death_shot_blocked";
  blocked.events[2]!.payload = { actorId: 1, targetId: 4, reason: "night_protection" };
  accepts(blocked);
  const silentPoison = shot([DeathCause.Poison]);
  silentPoison.decisions = [];
  silentPoison.events.pop();
  silentPoison.checkpoints[1]!.eventCount--;
  accepts(silentPoison);
  const replaced = shot([DeathCause.WolfKill]);
  replaced.checkpoints[1]!.players[0]!.privateState.hunter = { canShoot: true };
  accepts(replaced);
  // 后继 CP 的同值角色不证明原库存／生命仍同引用；这个接受不能被记成已证明枪可重开。
});

function words(origin: Phase, source: DeathCause[], day = 1, named = false) {
  const record = literal();
  if (named)
    record.metadata.normalizedBoard.lastWords = { policy: "netease_2017_day_and_first_night_v1" };
  night(record, 1, source, day);
  const d = request(1, "last_words", { name: "speak", args: { text: "literal last words" } });
  d.day = day;
  d.request.context.day = day;
  d.request.context.death_phase = origin;
  // 真正 LastWords 请求不要求 death_sources；来源证据来自独立的操作／事实，不能为审计补生产字段。
  record.decisions.push(d);
  event(record, "last_words_granted", { playerId: 1, phase: Phase.Day, day });
  event(record, "last_words_spoken", {
    playerId: 1,
    phase: Phase.Day,
    day,
    text: "literal last words",
  });
  const cp = checkpoint(record);
  cp.snapshot.day = day;
  cp.players[0]!.alive = false;
  return record;
}
test("LastWords source policy is independent of execution phase and does not require an unrecorded source field", () => {
  accepts(words(Phase.Night, [DeathCause.WolfKill]));
  accepts(words(Phase.Night, [DeathCause.Dream]));
  rejects(words(Phase.Night, [DeathCause.WolfKill], 2));
  rejects(words(Phase.Night, [DeathCause.Lovers]));
  const wrong = words(Phase.Day, [DeathCause.WolfKill]);
  wrong.decisions[0]!.request.context.death_sources = [DeathCause.WolfKill];
  rejects(wrong);
  const duel = words(Phase.Day, [DeathCause.DuelFailure]);
  duel.events[1] = {
    timestamp: 2,
    type: "knight_duel",
    payload: { actorId: 1, targetId: 4, result: "not_wolf" },
  };
  duel.operations = [];
  accepts(duel);
  const exile = words(Phase.Voting, [DeathCause.Exile]);
  exile.events[1] = { timestamp: 2, type: "voted_out", payload: { target: 1 } };
  exile.operations = [];
  accepts(exile);
  accepts(words(Phase.Night, [DeathCause.Lovers], 1, true));
  rejects(words(Phase.Night, [DeathCause.Lovers], 2, true));
  const blast = words(Phase.Day, [DeathCause.SelfDestruct], 1, true);
  blast.events[1] = {
    timestamp: 2,
    type: "wolf_self_destruct",
    payload: { wolfId: 1, window: "on_pre_vote" },
  };
  blast.operations = [];
  accepts(blast);
});

test("LastWords grants, opaque errors and source-wave evidence preserve legal failed prefixes", () => {
  const grantOnly = words(Phase.Night, [DeathCause.WolfKill]);
  grantOnly.events.pop();
  grantOnly.decisions[0]!.outcome = { kind: "action", action: null };
  grantOnly.checkpoints[1]!.eventCount--;
  accepts(grantOnly);
  const lateError = words(Phase.Night, [DeathCause.WolfKill]);
  lateError.decisions[0]!.outcome = { kind: "error", name: "Error", code: "decision_failed" };
  lateError.checkpoints[1]!.complete = false;
  lateError.checkpoints[1]!.failure = { name: "Error", code: "cycle_failed" };
  accepts(lateError);
  const noGrant = words(Phase.Night, [DeathCause.WolfKill]);
  noGrant.events.splice(2, 1);
  noGrant.checkpoints[1]!.eventCount--;
  rejects(noGrant);
  const noProvider = words(Phase.Night, [DeathCause.WolfKill]);
  noProvider.decisions[0]!.outcome = { kind: "action", action: null };
  rejects(noProvider);
  const later = words(Phase.Night, [DeathCause.WolfKill]);
  later.events.splice(2, 0, {
    timestamp: 2,
    type: "hunter_shot",
    payload: { hunterId: 1, targetId: 4 },
  });
  later.decisions.unshift(request(1, "hunter_shot", { name: "shoot", args: { target_id: 4 } }));
  later.events[3]!.payload.playerId = 4;
  later.events[4]!.payload.playerId = 4;
  later.decisions[1]!.actorId = 4;
  later.decisions[1]!.request.actorId = 4;
  later.checkpoints[1]!.eventCount++;
  rejects(later);
  later.metadata.normalizedBoard.lastWords = { policy: "netease_2017_day_and_first_night_v1" };
  accepts(later);
  const incomplete = literal();
  event(incomplete, "phase_changed", { day: 1, phase: Phase.Day });
  event(incomplete, "lovers_death", { actorId: 2, targetId: 4 });
  const cp = checkpoint(incomplete, false);
  expect(cp.players[3]!.alive).toBe(true);
  accepts(incomplete);
});

function badge(choice = true) {
  const record = literal();
  record.metadata.normalizedBoard.enableSheriff = true;
  record.metadata.normalizedBoard.initialSheriffSeat = 1;
  record.metadata.normalizedBoard.sheriff = {
    voteWeight: 2.25,
    badgePolicy: choice ? "awa_holder_choice_v1" : "awa_next_seat_v1",
  };
  for (const p of record.checkpoints[0]!.players) {
    p.badge = {
      isSheriff: p.id === 1,
      destroyed: false,
      voteWeight: 2.25,
      ...(choice ? { handoffPolicy: "awa_holder_choice_v1" } : {}),
    };
    p.vote.weight = p.id === 1 ? 2.25 : 1;
  }
  night(record, 1, [DeathCause.WolfKill]);
  if (choice)
    record.decisions.push(
      request(1, "sheriff_badge_choice", {
        name: "choose_badge_successor",
        args: { target_id: 4 },
      }),
    );
  event(record, "sheriff_badge_transferred", { fromId: 1, toId: 4, reason: "night_death" });
  const cp = checkpoint(record);
  cp.players[0]!.alive = false;
  cp.players[0]!.badge.isSheriff = false;
  cp.players[0]!.badge.destroyed = true;
  cp.players[0]!.vote.weight = 1;
  cp.players[3]!.badge.isSheriff = true;
  cp.players[3]!.vote.weight = 2.25;
  return record;
}
test("ordinary badge facts, original arbitrary weight and final CP form one ordered history", () => {
  const record = badge();
  accepts(record);
  const fact = structuredClone(record);
  fact.events[2]!.payload.toId = 5;
  rejects(fact);
  const cp = structuredClone(record);
  cp.checkpoints[1]!.players[3]!.badge.isSheriff = false;
  cp.checkpoints[1]!.players[4]!.badge.isSheriff = true;
  rejects(cp);
  const destroy = structuredClone(record);
  destroy.decisions[0]!.outcome = {
    kind: "action",
    action: { name: "choose_badge_successor", args: { target_id: null } },
  };
  destroy.events[2]!.type = "sheriff_badge_destroyed";
  destroy.events[2]!.payload = { targetId: 1, reason: "night_death" };
  destroy.checkpoints[1]!.players[3]!.badge.isSheriff = false;
  destroy.checkpoints[1]!.players[3]!.vote.weight = 1;
  accepts(destroy);
  const auto = badge(false);
  auto.events[2]!.payload.toId = 2;
  auto.checkpoints[1]!.players[3]!.badge.isSheriff = false;
  auto.checkpoints[1]!.players[3]!.vote.weight = 1;
  auto.checkpoints[1]!.players[1]!.badge.isSheriff = true;
  auto.checkpoints[1]!.players[1]!.vote.weight = 2.25;
  accepts(auto);
  const wrongOrder = structuredClone(auto);
  wrongOrder.events[2]!.payload.toId = 4;
  rejects(wrongOrder);
  const opaque = badge();
  opaque.decisions[0]!.outcome = { kind: "error", name: "Error", code: "decision_failed" };
  accepts(opaque);
  const second = structuredClone(record.decisions[0]!);
  second.outcome = {
    kind: "action",
    action: { name: "choose_badge_successor", args: { target_id: 5 } },
  };
  second.turn = 2;
  record.decisions.push(second);
  rejects(record);
});

test("failed badge CP allows precisely ordered clear/install prefixes but not an unexplained complete handoff", () => {
  const base = badge();
  base.events.pop();
  base.checkpoints[1]!.eventCount--;
  const partial = structuredClone(base);
  partial.checkpoints[1]!.complete = false;
  partial.checkpoints[1]!.failure = { name: "Error", code: "cycle_failed" };
  accepts(partial);
  rejects(base);
  const cleared = structuredClone(partial);
  cleared.checkpoints[1]!.players[3]!.badge.isSheriff = false;
  cleared.checkpoints[1]!.players[3]!.vote.weight = 1;
  accepts(cleared);
  const reverse = structuredClone(partial);
  reverse.checkpoints[1]!.players[0]!.badge.isSheriff = true;
  rejects(reverse);
  const knownNull = structuredClone(partial);
  knownNull.decisions[0]!.outcome = { kind: "action", action: null };
  rejects(knownNull);
  const wrongWeight = badge();
  wrongWeight.checkpoints[1]!.players[3]!.vote.weight = 1;
  rejects(wrongWeight);
  const late = badge();
  late.checkpoints[1]!.complete = false;
  late.checkpoints[1]!.failure = { name: "Error", code: "cycle_failed" };
  accepts(late);
  const untouched = literal();
  checkpoint(untouched, false);
  accepts(untouched);
  const special = badge();
  special.metadata.normalizedBoard.nobleSecretBody = { policy: "awa_noble_secret_body_v1" };
  special.checkpoints[1]!.players[3]!.badge.voteWeight = 9;
  accepts(special);
  // 只证明该特殊徽 CP 交给已先行执行的 owner，本单元直接入口不会复刻 Noble 审计或称权重9合法。
});

// generic blocked 不披露是哪份枪；明确 gift 请求适用默认枪源政策，miss 仍不可借 gift 窗口解释。
test("generic blocked facts use the actual gift window instead of the actor native knife or day policy", () => {
  for (const actorRole of [Role.Hunter, Role.WolfKing]) {
    const gift = shot([DeathCause.Shot], "awa_knife_or_exile_v1");
    if (actorRole === Role.WolfKing) {
      gift.metadata.players[0]!.role = actorRole;
      gift.metadata.normalizedBoard.roleSetups[0]!.role = actorRole;
      gift.metadata.normalizedBoard.wolfKing = { deathActionPolicy: "awa_day_deaths_v1" };
      for (const cp of gift.checkpoints) {
        cp.players[0]!.role = actorRole;
        cp.players[0]!.privateState = { wolfKing: { canShoot: cp.cycle === 0 } };
      }
    }
    gift.decisions[0]!.stage = "death_shot";
    gift.decisions[0]!.request.context.stage = "death_shot";
    gift.decisions[0]!.request.context.ability_id = "gift:literal:blocked";
    gift.events[2] = {
      timestamp: 3,
      type: "death_shot_blocked",
      payload: { actorId: 1, targetId: 4, reason: "night_protection" },
    };
    gift.checkpoints[1]!.players[3]!.alive = true;
    accepts(gift);
    const native = structuredClone(gift);
    delete native.decisions[0]!.request.context.ability_id;
    if (actorRole === Role.Hunter) {
      native.decisions[0]!.stage = "hunter_shot";
      native.decisions[0]!.request.context.stage = "hunter_shot";
    }
    rejects(native);
    const giftMiss = structuredClone(gift);
    giftMiss.events[2] = {
      timestamp: 3,
      type: "death_shot_missed",
      payload: { actorId: 1, reason: "no_effect" },
    };
    rejects(giftMiss);
  }
});

// 唯一竞选候选按冻结 PK 政策免投票；这里只手写原 assign 的逐字段失败前缀，不从生产命令生成 CP。
test("single finalized sheriff candidate can explain a failed assignment prefix without a vote decision", () => {
  const record = literal();
  record.metadata.normalizedBoard.enableSheriff = true;
  record.metadata.normalizedBoard.sheriff = {
    voteWeight: 2.25,
    badgePolicy: "awa_holder_choice_v1",
    electionPolicy: "awa_nomination_offstage_pk_v1",
  };
  event(record, "phase_changed", { phase: Phase.Day, day: 1 });
  event(record, "sheriff_candidates_finalized", { candidates: [3] });
  const partial = checkpoint(record, false);
  for (const id of [1, 2]) {
    partial.players[id - 1]!.badge = {
      isSheriff: false,
      destroyed: false,
      voteWeight: 2.25,
      handoffPolicy: "awa_holder_choice_v1",
    };
  }
  // 两个更早席位已写完，候选仅首 isSheriff 写成功；后续字段错误可先于当选事实与投票决定。
  partial.players[2]!.badge.isSheriff = true;
  expect(record.decisions).toEqual([]);
  accepts(record);
  const complete = structuredClone(record);
  complete.checkpoints[1]!.complete = true;
  delete complete.checkpoints[1]!.failure;
  rejects(complete);
  const later = structuredClone(record);
  later.checkpoints[1]!.eventCount = 1;
  rejects(later);
});

// 前一 CP 已死席位不进入 assign；来源提案没有死亡收据时，手写两种有据前缀，拒绝颠倒字段写序。
test("failed sheriff assignment skips known dead seats and keeps bounded write or skip prefixes for uncertain proposals", () => {
  function partial(kind: "known_dead" | "unknown_skip" | "unknown_write") {
    const record = literal();
    record.metadata.normalizedBoard.enableSheriff = true;
    record.metadata.normalizedBoard.sheriff = {
      voteWeight: 2.25,
      badgePolicy: "awa_holder_choice_v1",
      electionPolicy: "awa_nomination_offstage_pk_v1",
    };
    if (kind === "known_dead") {
      // 初始装配仍全活；先有夜来源与完整 CP 的已死读数，才进入后继选举的失败 CP。
      night(record, 1, [DeathCause.WolfKill]);
      const previous = checkpoint(record);
      previous.players[0]!.alive = false;
    } else night(record, 1, [DeathCause.WolfKill]);
    event(record, "sheriff_candidates_finalized", { candidates: [3] });
    const cp = checkpoint(record, false);
    cp.players[0]!.alive = false;
    // 活席2已完成全部字段，候选3只完成第一个 isSheriff；早席1是原徽或已写新徽两种字面输入。
    cp.players[1]!.badge = {
      isSheriff: false,
      destroyed: false,
      voteWeight: 2.25,
      handoffPolicy: "awa_holder_choice_v1",
    };
    cp.players[2]!.badge.isSheriff = true;
    if (kind === "unknown_write")
      cp.players[0]!.badge = {
        isSheriff: false,
        destroyed: false,
        voteWeight: 2.25,
        handoffPolicy: "awa_holder_choice_v1",
      };
    return record;
  }
  accepts(partial("known_dead"));
  accepts(partial("unknown_skip"));
  accepts(partial("unknown_write"));
  const reverse = partial("known_dead");
  reverse.checkpoints.at(-1)!.players[2]!.badge.isSheriff = false;
  reverse.checkpoints.at(-1)!.players[2]!.badge.voteWeight = 2.25;
  rejects(reverse);
});
