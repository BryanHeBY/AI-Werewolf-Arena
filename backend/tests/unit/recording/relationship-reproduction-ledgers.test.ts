/**
 * 负责单元测试：用手写纯 JSON Tape 核对丘比特／混血儿独立档案账本，不运行角色结算或生产 World。
 * 输入是字面的角色、选择、关系、归属及成功／失败 checkpoint；预期为明确的接受或家族错误名，非由生产算法生成。
 * 覆盖原写序的部分付款、事实尚未标死、历史归属、私有知识、伪造成员及装配首错；不证明未录制的生命原体或租约。
 * 新严格拒绝不进入公开回放 reader；历史公开 fixture 的原接受单独保留，测试不调用模型／完整对局／seed 矩阵。
 */
import { expect, test } from "bun:test";
import {
  Camp,
  Phase,
  Role,
  WinCondition,
  type BoardConfig,
  type ToolCall,
} from "@ai-werewolf-arena/game-contract";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  parseReproductionRecord,
  type RecordedCheckpoint,
  type RecordedDecision,
  type ReproductionRecord,
} from "../../../src/recording/reproduction/format";
import { validateCupidRecord } from "../../../src/recording/verification/cupid/validate";
import { validateHybridRecord } from "../../../src/recording/verification/hybrid/validate";
import { verifyReproductionMechanisms } from "../../../src/recording/verification/assembly";

type Family = "cupid" | "hybrid";
const netease = "netease_2017_cupid_follows_lovers_v1" as const;
const lui = "lui_meme_lovers_only_v1" as const;
const cupidError = "reproduction_cupid_state_invalid";
const hybridError = "reproduction_hybrid_state_invalid";
// 只组装惰性数据；所有与本批相关的初态／付款／胜利预期在下面各 fixture 中直接写出。
function initial(family: Family): ReproductionRecord {
  const roles =
    family === "cupid"
      ? [Role.Cupid, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Hunter]
      : [Role.Hybrid, Role.Wolf, Role.HiddenWolf, Role.Villager, Role.Villager, Role.Hunter];
  const board: BoardConfig = {
    boardSize: 6,
    enableSheriff: false,
    winConditions: [WinCondition.SlaughterCity],
    hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    ...(family === "cupid" ? { cupid: { policy: netease } } : {}),
  };
  const players = roles.map((role, index) => ({
    id: index + 1,
    name: `P${index + 1}`,
    role,
    camp: role === Role.Wolf || role === Role.HiddenWolf ? Camp.Wolf : Camp.Good,
  }));
  return {
    schemaVersion: 2,
    finalized: false,
    metadata: {
      engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
      random: {
        seed: "literal-ledger",
        algorithm: "mulberry32-fnv1a-utf16-v1",
        streamPolicy: "named-path-v1",
        path: [],
      },
      ruleset: { id: "awa_classic", version: "1.0.0" },
      boardId: `literal_${family}`,
      normalizedBoard: board,
      locale: "zh-CN",
      maxDays: 3,
      dealMode: "fixed",
      players,
    },
    decisions: [],
    events: [],
    operations: [],
    termination: null,
    checkpoints: [
      {
        cycle: 0,
        complete: true,
        eventCount: 0,
        snapshot: { day: 1, phase: Phase.Night, gameOver: false, result: null },
        players: players.map((p): RecordedCheckpoint["players"][number] => ({
          ...p,
          seat: p.id,
          alive: true,
          privateState:
            p.id === 1
              ? family === "cupid"
                ? { cupid: { policy: netease, remaining: 1, choice: null } }
                : { hybrid: { remaining: 1, choice: null } }
              : {},
          victory: {
            affiliations:
              p.id === 1 && family === "hybrid" ? [] : [{ kind: "faction", faction: p.camp }],
          },
          vote: { weight: 1, canVote: true },
          badge: { isSheriff: false, destroyed: false, voteWeight: 1 },
          marks: [],
        })),
      },
    ],
  };
}
function choose(family: Family): RecordedDecision {
  const tool = family === "cupid" ? "choose_lovers" : "choose_exemplar";
  const action: ToolCall =
    family === "cupid"
      ? { name: "choose_lovers", args: { first_id: 2, second_id: 4 } }
      : { name: "choose_exemplar", args: { target_id: 2 } };
  return {
    actorId: 1,
    day: 1,
    stage: family,
    turn: 1,
    openedAfterSettlement: 0,
    settleOrder: 1,
    request: {
      actorId: 1,
      phase: Phase.Night,
      allowedTools: [tool],
      context: {
        day: 1,
        stage: family,
        visible_events: [],
        allow_fallback: false,
        ...(family === "cupid" ? { action_failure_policy: "error" as const } : {}),
        turn_constraints: {
          min_valid_actions: 1,
          max_valid_actions: 1,
          required_any_tools: [tool],
        },
      },
    },
    outcome: { kind: "action", action },
  };
}
function nextCheckpoint(record: ReproductionRecord): RecordedCheckpoint {
  const cp = structuredClone(record.checkpoints[0]!);
  cp.cycle = 1;
  cp.snapshot.phase = Phase.Day;
  record.checkpoints.push(cp);
  return cp;
}
function cupidMixed(policy: typeof netease | typeof lui = netease): ReproductionRecord {
  const record = initial("cupid");
  record.metadata.normalizedBoard.cupid = { policy };
  record.checkpoints[0]!.players[0]!.privateState.cupid = { policy, remaining: 1, choice: null };
  record.decisions.push(choose("cupid"));
  const relation = {
    actorId: 1,
    day: 1 as const,
    policy,
    pairIds: [2, 4] as const,
    pairCamps: [Camp.Wolf, Camp.Good] as const,
    groupId: "cupid_lovers" as const,
    mixed: true,
  };
  record.events = [
    { timestamp: 1, type: "cupid_lovers_chosen", payload: { actorId: 1, day: 1, pairIds: [2, 4] } },
    { timestamp: 2, type: "lover_recognized", payload: { actorId: 2, partnerId: 4 } },
    { timestamp: 3, type: "lover_recognized", payload: { actorId: 4, partnerId: 2 } },
    { timestamp: 4, type: "cupid_relation_resolved", payload: relation },
  ];
  const cp = nextCheckpoint(record);
  cp.eventCount = 4;
  cp.players[0]!.lovers = relation;
  cp.players[0]!.privateState.cupid = { policy, remaining: 0, choice: { day: 1, pairIds: [2, 4] } };
  cp.players[1]!.victory = { affiliations: [{ kind: "relationship", groupId: "cupid_lovers" }] };
  cp.players[3]!.victory = { affiliations: [{ kind: "relationship", groupId: "cupid_lovers" }] };
  if (policy === netease)
    cp.players[0]!.victory = { affiliations: [{ kind: "relationship", groupId: "cupid_lovers" }] };
  return record;
}
function hybridWolf(): ReproductionRecord {
  const record = initial("hybrid");
  record.decisions.push(choose("hybrid"));
  record.events = [
    { timestamp: 1, type: "hybrid_exemplar_chosen", payload: { actorId: 1, day: 1, targetId: 2 } },
    {
      timestamp: 2,
      type: "hybrid_affiliation_resolved",
      payload: { actorId: 1, day: 1, targetId: 2, faction: Camp.Wolf },
    },
  ];
  const cp = nextCheckpoint(record);
  cp.eventCount = 2;
  cp.players[0]!.privateState.hybrid = { remaining: 0, choice: { day: 1, targetId: 2 } };
  cp.players[0]!.victory = { affiliations: [{ kind: "faction", faction: Camp.Wolf }] };
  return record;
}
function failure(record: ReproductionRecord, eventCount: number): RecordedCheckpoint {
  record.events = record.events.slice(0, eventCount);
  const cp = record.checkpoints[1]!;
  cp.eventCount = eventCount;
  cp.complete = false;
  cp.snapshot.phase = Phase.Night;
  cp.failure = { name: "Error", code: "cycle_failed" };
  return cp;
}
function reject(record: ReproductionRecord, family: Family): void {
  expect(() =>
    family === "cupid" ? validateCupidRecord(record) : validateHybridRecord(record),
  ).toThrow(family === "cupid" ? cupidError : hybridError);
}

test("Cupid: two policies keep mixed members separate from identity and include only declared dead or living winners", () => {
  for (const policy of [netease, lui]) {
    const record = cupidMixed(policy),
      cp = record.checkpoints[1]!;
    const alive = policy === netease ? [1, 2, 4] : [2, 4];
    const winners = policy === netease ? [1, 2, 4] : [2, 4];
    cp.players.forEach((p) => {
      p.alive = alive.includes(p.id);
    });
    cp.snapshot = {
      day: 1,
      phase: Phase.GameOver,
      gameOver: true,
      result: {
        winner: null,
        reason: "cupid_lovers_only_survivors",
        outcome: {
          kind: "victory",
          primary: { kind: "relationship", groupId: "cupid_lovers", winningPlayerIds: winners },
          additional: [],
          winningPlayerIds: winners,
        },
        decidedAt: { day: 1, phase: Phase.Voting, checkpoint: "exile_settled" },
      },
    };
    record.events.push({ timestamp: 5, type: "game_over", payload: { ...cp.snapshot.result! } });
    cp.eventCount = 5;
    const before = structuredClone(record);
    expect(() => validateCupidRecord(record)).not.toThrow();
    expect(() => verifyReproductionMechanisms(record)).not.toThrow();
    expect(parseReproductionRecord(record).checkpoints[1]!.players[0]!.camp).toBe(Camp.Good);
    expect(record).toEqual(before);
    const terminalFailure = structuredClone(record);
    terminalFailure.checkpoints[1]!.complete = false;
    terminalFailure.checkpoints[1]!.failure = { name: "Error", code: "cycle_failed" };
    expect(() => validateCupidRecord(terminalFailure)).not.toThrow();
    const forged = structuredClone(record);
    forged.checkpoints[1]!.players[0]!.victory = {
      affiliations: [{ kind: "faction", faction: Camp.Wolf }],
    };
    reject(forged, "cupid");
    const member = structuredClone(record);
    const result = member.checkpoints[1]!.snapshot.result!;
    if (result.outcome.kind === "victory") result.outcome.winningPlayerIds = [2, 4, 6];
    reject(member, "cupid");
  }
});

test("Cupid: selecting the actor gives both source policies exactly the two declared relationship members", () => {
  for (const policy of [netease, lui]) {
    const record = cupidMixed(policy),
      cp = record.checkpoints[1]!;
    const relation = {
      actorId: 1,
      day: 1 as const,
      policy,
      pairIds: [1, 2] as const,
      pairCamps: [Camp.Good, Camp.Wolf] as const,
      groupId: "cupid_lovers" as const,
      mixed: true,
    };
    record.decisions[0]!.outcome = {
      kind: "action",
      action: { name: "choose_lovers", args: { first_id: 1, second_id: 2 } },
    };
    record.events = [
      {
        timestamp: 1,
        type: "cupid_lovers_chosen",
        payload: { actorId: 1, day: 1, pairIds: [1, 2] },
      },
      { timestamp: 2, type: "lover_recognized", payload: { actorId: 1, partnerId: 2 } },
      { timestamp: 3, type: "lover_recognized", payload: { actorId: 2, partnerId: 1 } },
      { timestamp: 4, type: "cupid_relation_resolved", payload: relation },
    ];
    cp.players[0]!.lovers = relation;
    cp.players[0]!.privateState.cupid = {
      policy,
      remaining: 0,
      choice: { day: 1, pairIds: [1, 2] },
    };
    cp.players[0]!.victory = { affiliations: [{ kind: "relationship", groupId: "cupid_lovers" }] };
    cp.players[3]!.victory = { affiliations: [{ kind: "faction", faction: Camp.Good }] };
    cp.players.forEach((p) => {
      p.alive = p.id === 1 || p.id === 2;
    });
    cp.snapshot = {
      day: 1,
      phase: Phase.GameOver,
      gameOver: true,
      result: {
        winner: null,
        reason: "cupid_lovers_only_survivors",
        outcome: {
          kind: "victory",
          primary: { kind: "relationship", groupId: "cupid_lovers", winningPlayerIds: [1, 2] },
          additional: [],
          winningPlayerIds: [1, 2],
        },
        decidedAt: { day: 1, phase: Phase.Voting, checkpoint: "exile_settled" },
      },
    };
    expect(() => validateCupidRecord(record)).not.toThrow();
  }
});

test("Cupid: same-Wolf pair changes membership without changing the independent Cupid's Good identity", () => {
  for (const policy of [netease, lui]) {
    const record = cupidMixed(policy),
      cp = record.checkpoints[1]!;
    const relation = {
      actorId: 1,
      day: 1 as const,
      policy,
      pairIds: [2, 3] as const,
      pairCamps: [Camp.Wolf, Camp.Wolf] as const,
      groupId: "cupid_lovers" as const,
      mixed: false,
    };
    record.decisions[0]!.outcome = {
      kind: "action",
      action: { name: "choose_lovers", args: { first_id: 2, second_id: 3 } },
    };
    record.events = [
      {
        timestamp: 1,
        type: "cupid_lovers_chosen",
        payload: { actorId: 1, day: 1, pairIds: [2, 3] },
      },
      { timestamp: 2, type: "lover_recognized", payload: { actorId: 2, partnerId: 3 } },
      { timestamp: 3, type: "lover_recognized", payload: { actorId: 3, partnerId: 2 } },
      { timestamp: 4, type: "cupid_relation_resolved", payload: relation },
    ];
    cp.players[0]!.lovers = relation;
    cp.players[0]!.privateState.cupid = {
      policy,
      remaining: 0,
      choice: { day: 1, pairIds: [2, 3] },
    };
    cp.players[0]!.victory = {
      affiliations: [{ kind: "faction", faction: policy === netease ? Camp.Wolf : Camp.Good }],
    };
    cp.players[1]!.victory = { affiliations: [{ kind: "faction", faction: Camp.Wolf }] };
    cp.players[2]!.victory = { affiliations: [{ kind: "faction", faction: Camp.Wolf }] };
    cp.players[3]!.victory = { affiliations: [{ kind: "faction", faction: Camp.Good }] };
    expect(() => validateCupidRecord(record)).not.toThrow();
    cp.players[0]!.camp = Camp.Wolf;
    reject(record, "cupid");
  }
});

test("Cupid: failed checkpoint keeps bound relation, debit, partial ordered membership and partial publication", () => {
  const bound = cupidMixed(),
    cp = failure(bound, 0);
  cp.players.forEach((p, i) => {
    p.victory = structuredClone(bound.checkpoints[0]!.players[i]!.victory);
  });
  cp.players[0]!.privateState.cupid = { policy: netease, remaining: 1, choice: null };
  expect(() => validateCupidRecord(bound)).not.toThrow();
  const debited = structuredClone(bound);
  debited.checkpoints[1]!.players[0]!.privateState.cupid = {
    policy: netease,
    remaining: 0,
    choice: null,
  };
  expect(() => validateCupidRecord(debited)).not.toThrow();
  const partiallyInstalled = cupidMixed(),
    install = failure(partiallyInstalled, 0);
  install.players[0]!.victory = { affiliations: [{ kind: "faction", faction: Camp.Good }] };
  install.players[3]!.victory = { affiliations: [{ kind: "faction", faction: Camp.Good }] };
  expect(() => validateCupidRecord(partiallyInstalled)).not.toThrow();
  const publication = cupidMixed();
  failure(publication, 1);
  expect(() => validateCupidRecord(publication)).not.toThrow();
  const reversed = structuredClone(partiallyInstalled);
  reversed.checkpoints[1]!.players[1]!.victory = {
    affiliations: [{ kind: "faction", faction: Camp.Wolf }],
  };
  reversed.checkpoints[1]!.players[0]!.victory = {
    affiliations: [{ kind: "relationship", groupId: "cupid_lovers" }],
  };
  reject(reversed, "cupid");
  const missingRelation = structuredClone(debited);
  delete missingRelation.checkpoints[1]!.players[0]!.lovers;
  reject(missingRelation, "cupid");
  publication.checkpoints[1]!.complete = true;
  delete publication.checkpoints[1]!.failure;
  reject(publication, "cupid");
});

test("Cupid: pre-commit death fact is not physical death; forged recognition, duplicate death and suppressed gun are rejected", () => {
  const record = cupidMixed();
  record.events.push({ timestamp: 5, type: "lovers_death", payload: { actorId: 2, targetId: 4 } });
  const cp = failure(record, 5);
  expect(() => validateCupidRecord(record)).not.toThrow();
  expect(cp.players[3]!.alive).toBe(true);
  const duplicate = structuredClone(record);
  duplicate.events.push(structuredClone(record.events[4]!));
  reject(duplicate, "cupid");
  const recognized = structuredClone(record);
  recognized.events[1]!.payload.partnerId = 5;
  reject(recognized, "cupid");
  const shot = structuredClone(record);
  shot.events.push({ timestamp: 6, type: "player_shot", payload: { actorId: 4, targetId: 5 } });
  reject(shot, "cupid");
  cp.complete = true;
  delete cp.failure;
  reject(record, "cupid");
});

test("Cupid: retry request contract, private recognition and unrecorded hidden data remain distinct", () => {
  const record = cupidMixed();
  const notice: RecordedDecision = {
    actorId: 2,
    day: 1,
    stage: "day_speech",
    turn: 1,
    openedAfterSettlement: 1,
    request: {
      actorId: 2,
      phase: Phase.Day,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        turn_constraints: {},
        visible_events: [
          { seq: 1, type: "lover_recognized", payload: { actorId: 2, partnerId: 4 } },
        ],
      },
    },
    outcome: { kind: "pending" },
  };
  record.decisions.push(notice);
  expect(() => validateCupidRecord(record)).not.toThrow();
  const hidden = structuredClone(record);
  hidden.decisions[1]!.request.context.visible_events.push({
    seq: 2,
    type: "cupid_relation_resolved",
    payload: { ...record.events[3]!.payload },
  });
  reject(hidden, "cupid");
  const other = structuredClone(record);
  other.decisions[1]!.request.actorId = 5;
  other.decisions[1]!.actorId = 5;
  reject(other, "cupid");
  const late = structuredClone(record);
  late.decisions[0]!.day = 2;
  reject(late, "cupid");
  const retry = structuredClone(record),
    first = structuredClone(retry.decisions[0]!);
  first.outcome = { kind: "action", action: null };
  retry.decisions[0] = first;
  retry.decisions.splice(1, 0, choose("cupid"));
  retry.decisions[1]!.turn = 2;
  retry.decisions[1]!.request.context.retry_attempt = 1;
  retry.decisions[1]!.request.context.retry_max = 2;
  expect(() => validateCupidRecord(retry)).not.toThrow();
  retry.decisions[1]!.request.context.retry_attempt = 2;
  reject(retry, "cupid");
});

test("Hybrid: frozen Wolf membership survives both deaths while role and actual Camp stay Good", () => {
  const record = hybridWolf(),
    cp = record.checkpoints[1]!;
  cp.players[0]!.alive = false;
  cp.players[1]!.alive = false;
  cp.players[3]!.alive = false;
  cp.players[4]!.alive = false;
  cp.players[5]!.alive = false;
  cp.snapshot = {
    day: 1,
    phase: Phase.GameOver,
    gameOver: true,
    result: {
      winner: Camp.Wolf,
      reason: "all_good_eliminated",
      outcome: {
        kind: "victory",
        primary: { kind: "faction", faction: Camp.Wolf, winningPlayerIds: [1, 2, 3] },
        additional: [],
        winningPlayerIds: [1, 2, 3],
      },
      decidedAt: { day: 1, phase: Phase.Voting, checkpoint: "exile_settled" },
    },
  };
  expect(() => validateHybridRecord(record)).not.toThrow();
  expect(() => verifyReproductionMechanisms(record)).not.toThrow();
  expect(parseReproductionRecord(record).checkpoints[1]!.players[0]!.camp).toBe(Camp.Good);
  const terminalFailure = structuredClone(record);
  terminalFailure.checkpoints[1]!.complete = false;
  terminalFailure.checkpoints[1]!.failure = { name: "Error", code: "cycle_failed" };
  expect(() => validateHybridRecord(terminalFailure)).not.toThrow();
  const wrong = structuredClone(record);
  wrong.checkpoints[1]!.players[0]!.victory = {
    affiliations: [{ kind: "faction", faction: Camp.Good }],
  };
  reject(wrong, "hybrid");
  const identity = structuredClone(record);
  identity.checkpoints[1]!.players[0]!.camp = Camp.Wolf;
  reject(identity, "hybrid");
  const members = structuredClone(record),
    result = members.checkpoints[1]!.snapshot.result!;
  if (result.outcome.kind === "victory") result.outcome.primary.winningPlayerIds = [2, 3];
  reject(members, "hybrid");
});

test("Hybrid: Good target has independent Good affiliation and Wolf-half cannot count the follower as a real wolf", () => {
  const hidden = hybridWolf();
  hidden.decisions[0]!.outcome = {
    kind: "action",
    action: { name: "choose_exemplar", args: { target_id: 3 } },
  };
  hidden.events[0]!.payload.targetId = 3;
  hidden.events[1]!.payload.targetId = 3;
  hidden.checkpoints[1]!.players[0]!.privateState.hybrid = {
    remaining: 0,
    choice: { day: 1, targetId: 3 },
  };
  expect(() => validateHybridRecord(hidden)).not.toThrow();
  const record = hybridWolf(),
    cp = record.checkpoints[1]!;
  record.decisions[0]!.outcome = {
    kind: "action",
    action: { name: "choose_exemplar", args: { target_id: 4 } },
  };
  record.events[0]!.payload.targetId = 4;
  record.events[1]!.payload = { actorId: 1, day: 1, targetId: 4, faction: Camp.Good };
  cp.players[0]!.privateState.hybrid = { remaining: 0, choice: { day: 1, targetId: 4 } };
  cp.players[0]!.victory = { affiliations: [{ kind: "faction", faction: Camp.Good }] };
  expect(() => validateHybridRecord(record)).not.toThrow();
  record.metadata.normalizedBoard.winConditions = [WinCondition.WolfReachHalf];
  cp.snapshot = {
    day: 1,
    phase: Phase.GameOver,
    gameOver: true,
    result: {
      winner: Camp.Wolf,
      reason: "wolves_reach_half",
      outcome: {
        kind: "victory",
        primary: { kind: "faction", faction: Camp.Wolf, winningPlayerIds: [2, 3] },
        additional: [],
        winningPlayerIds: [2, 3],
      },
      decidedAt: { day: 1, phase: Phase.Voting, checkpoint: "exile_settled" },
    },
  };
  // 实际2狼4好，不能用跟随归属把真实人数凑成半数。
  reject(record, "hybrid");
});

test("Hybrid: failed checkpoint accepts debit-before-choice and install-before-fact without refund", () => {
  const debit = hybridWolf(),
    cp = failure(debit, 0);
  cp.players[0]!.privateState.hybrid = { remaining: 0, choice: null };
  cp.players[0]!.victory = { affiliations: [] };
  expect(() => validateHybridRecord(debit)).not.toThrow();
  const choice = hybridWolf(),
    chosen = failure(choice, 0);
  chosen.players[0]!.victory = { affiliations: [] };
  expect(() => validateHybridRecord(choice)).not.toThrow();
  const installed = hybridWolf();
  failure(installed, 0);
  expect(() => validateHybridRecord(installed)).not.toThrow();
  const published = hybridWolf();
  failure(published, 1);
  expect(() => validateHybridRecord(published)).not.toThrow();
  const reversed = structuredClone(debit);
  reversed.checkpoints[1]!.players[0]!.victory = {
    affiliations: [{ kind: "faction", faction: Camp.Wolf }],
  };
  reject(reversed, "hybrid");
  const refunded = structuredClone(choice);
  refunded.checkpoints[1]!.players[0]!.privateState.hybrid = {
    remaining: 1,
    choice: { day: 1, targetId: 2 },
  };
  reject(refunded, "hybrid");
  const falseComplete = structuredClone(installed);
  falseComplete.checkpoints[1]!.complete = true;
  delete falseComplete.checkpoints[1]!.failure;
  reject(falseComplete, "hybrid");
});

test("Hybrid: foreign target, forged hidden camp, repeated facts and leaked knowledge reject independently", () => {
  const record = hybridWolf();
  const badCamp = structuredClone(record);
  badCamp.events[1]!.payload.faction = Camp.Good;
  reject(badCamp, "hybrid");
  const self = structuredClone(record);
  self.events[0]!.payload.targetId = 1;
  reject(self, "hybrid");
  const repeated = structuredClone(record);
  repeated.events.push(structuredClone(record.events[0]!));
  reject(repeated, "hybrid");
  const leaked = structuredClone(record);
  leaked.decisions[0]!.request.context.visible_events.push({
    seq: 1,
    type: "hybrid_affiliation_resolved",
    payload: { ...record.events[1]!.payload },
  });
  reject(leaked, "hybrid");
  const extra = structuredClone(record);
  extra.events[0]!.payload.faction = Camp.Wolf;
  reject(extra, "hybrid");
});

test("strict assembly adds rejection after the original sixteen; historical public reader remains separate", () => {
  expect(() => parseReproductionRecord(initial("cupid"))).not.toThrow();
  expect(() => parseReproductionRecord(initial("hybrid"))).not.toThrow();
  const stray = initial("hybrid");
  stray.events.push({
    timestamp: 1,
    type: "cupid_lovers_chosen",
    payload: { actorId: 1, day: 1, pairIds: [2, 4] },
  });
  expect(() => verifyReproductionMechanisms(stray)).toThrow(cupidError);
  const first = structuredClone(stray);
  first.events.unshift({ timestamp: 0, type: "shapeshifter_identity_chosen", payload: {} });
  expect(() => verifyReproductionMechanisms(first)).toThrow("reproduction_thief_state_invalid");
  // 同一新严格错误可以先于执行器的构建不匹配；公开 schema2 没有进入 strict assembly。
  const oldHash = cupidMixed();
  oldHash.metadata.engine.sourceHash = "0".repeat(64);
  oldHash.events[1]!.payload.partnerId = 5;
  expect(() => parseReproductionRecord(oldHash)).toThrow(cupidError);
  const publicDocument = {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "historical-public",
    meta: { board: "historical", startedAt: "old", endedAt: "old" },
    result: { winner: null, reason: null },
    players: [{ player_id: 1, role: Role.Cupid, camp: Camp.Good }],
    events: [
      {
        seq: 1,
        timestamp: "old",
        day: 1,
        phase: Phase.Night,
        type: "cupid_lovers_chosen",
        payload: { historical: "untouched" },
      },
    ],
  };
  expect(readReplayDocument(publicDocument).events[0]!.payload).toEqual({
    historical: "untouched",
  });
});

test("Cupid: opaque settlement error or pending preserves the literal paid prefix without inventing a recorded reply", () => {
  const record = cupidMixed();
  failure(record, 1);
  record.decisions[0]!.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  expect(() => validateCupidRecord(record)).not.toThrow();
  const pending = structuredClone(record);
  pending.decisions[0]!.outcome = { kind: "pending" };
  expect(() => validateCupidRecord(pending)).not.toThrow();
  const conflicting = structuredClone(record);
  conflicting.decisions[0]!.outcome = {
    kind: "action",
    action: { name: "choose_lovers", args: { first_id: 2, second_id: 5 } },
  };
  reject(conflicting, "cupid");
  const later = structuredClone(conflicting),
    second = choose("cupid");
  second.turn = 2;
  second.request.context.retry_attempt = 1;
  second.request.context.retry_max = 2;
  second.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  later.decisions.push(second);
  expect(() => validateCupidRecord(later)).not.toThrow();
  const impossible = structuredClone(later);
  impossible.events[0]!.payload.pairIds = [2, 5];
  reject(impossible, "cupid");
});

test("Hybrid: opaque settlement error or pending preserves consumed selection while recorded-only conflicts still reject", () => {
  const record = hybridWolf();
  failure(record, 0);
  record.decisions[0]!.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  expect(() => validateHybridRecord(record)).not.toThrow();
  const pending = structuredClone(record);
  pending.decisions[0]!.outcome = { kind: "pending" };
  expect(() => validateHybridRecord(pending)).not.toThrow();
  const conflicting = structuredClone(record);
  conflicting.decisions[0]!.outcome = {
    kind: "action",
    action: { name: "choose_exemplar", args: { target_id: 4 } },
  };
  reject(conflicting, "hybrid");
  const earlier = structuredClone(record),
    last = choose("hybrid");
  last.turn = 2;
  last.request.context.retry_attempt = 1;
  last.request.context.retry_max = 2;
  last.outcome = { kind: "action", action: { name: "choose_exemplar", args: { target_id: 4 } } };
  earlier.decisions.push(last);
  reject(earlier, "hybrid");
});

test("last family decision alone can explain payment; early matching candidates cannot hide later known null or invalid replies", () => {
  for (const family of ["cupid", "hybrid"] as const) {
    const record = family === "cupid" ? cupidMixed() : hybridWolf();
    const last = choose(family);
    last.turn = 2;
    last.request.context.retry_attempt = 1;
    last.request.context.retry_max = 2;
    last.outcome =
      family === "cupid"
        ? { kind: "action", action: { name: "choose_lovers", args: { first_id: 2, second_id: 5 } } }
        : { kind: "action", action: { name: "choose_exemplar", args: { target_id: 4 } } };
    record.decisions.push(last);
    reject(record, family);
    const nullReply = structuredClone(record);
    nullReply.decisions[1]!.outcome = { kind: "action", action: null };
    reject(nullReply, family);
    const invalid = structuredClone(record);
    invalid.decisions[1]!.outcome = {
      kind: "action",
      action: { name: "speak", args: { text: "literal_invalid_family_reply" } },
    };
    reject(invalid, family);
    const opaque = structuredClone(record);
    opaque.decisions[1]!.outcome = { kind: "error", code: "decision_failed", name: "Error" };
    expect(() =>
      family === "cupid" ? validateCupidRecord(opaque) : validateHybridRecord(opaque),
    ).not.toThrow();
    opaque.decisions[1]!.outcome = { kind: "pending" };
    expect(() =>
      family === "cupid" ? validateCupidRecord(opaque) : validateHybridRecord(opaque),
    ).not.toThrow();
  }
  // 仅写 remaining 的失败前缀也不能借早先有效榜样绕过最后的空回复。
  const debit = hybridWolf(),
    cp = failure(debit, 0),
    last = choose("hybrid");
  cp.players[0]!.privateState.hybrid = { remaining: 0, choice: null };
  cp.players[0]!.victory = { affiliations: [] };
  last.turn = 2;
  last.request.context.retry_attempt = 1;
  last.request.context.retry_max = 2;
  last.outcome = { kind: "action", action: null };
  debit.decisions.push(last);
  reject(debit, "hybrid");
  last.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  expect(() => validateHybridRecord(debit)).not.toThrow();
});

test("returned candidate: the last known reply constrains both ledgers without manufacturing payment", () => {
  for (const family of ["cupid", "hybrid"] as const) {
    const record = family === "cupid" ? cupidMixed() : hybridWolf();
    failure(record, 0);
    record.schemaVersion = 3;
    record.decisions[0]!.outcome = { kind: "error", code: "decision_failed", name: "Error" };
    record.decisions[0]!.returnedCandidate =
      family === "cupid"
        ? { name: "choose_lovers", args: { first_id: 2, second_id: 4 } }
        : { name: "choose_exemplar", args: { target_id: 2 } };
    // 两份手写 fixture 已给完整安装但尚无事实的失败前缀；候选只限制输入，不把 false 改成 true。
    expect(() => parseReproductionRecord(record)).not.toThrow();
    const nullReply = structuredClone(record);
    nullReply.decisions[0]!.returnedCandidate = null;
    expect(() => parseReproductionRecord(nullReply)).toThrow(
      family === "cupid" ? cupidError : hybridError,
    );
    const invalid = structuredClone(record);
    invalid.decisions[0]!.returnedCandidate = {
      name: "speak",
      args: { text: "not the requested choice" },
    };
    expect(() => parseReproductionRecord(invalid)).toThrow(
      family === "cupid" ? cupidError : hybridError,
    );
    const conflict = structuredClone(record);
    conflict.decisions[0]!.returnedCandidate =
      family === "cupid"
        ? { name: "choose_lovers", args: { first_id: 2, second_id: 5 } }
        : { name: "choose_exemplar", args: { target_id: 4 } };
    expect(() => parseReproductionRecord(conflict)).toThrow(
      family === "cupid" ? cupidError : hybridError,
    );
    const unpaid = structuredClone(record);
    unpaid.checkpoints[1]!.players = structuredClone(unpaid.checkpoints[0]!.players);
    expect(() => parseReproductionRecord(unpaid)).not.toThrow();
    const legacy = structuredClone(record);
    legacy.schemaVersion = 2;
    delete legacy.decisions[0]!.returnedCandidate;
    expect(() => parseReproductionRecord(legacy)).not.toThrow();
  }
});
