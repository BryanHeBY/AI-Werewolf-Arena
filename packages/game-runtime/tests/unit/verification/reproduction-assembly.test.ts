/**
 * 单元测试验证独立 reproduction 审计的完整装配、第一拒绝和 schema 前置准入。
 * 输入是手写六席纯数据归档及明确伪造的角色残留；预期为字面调用顺序与原拒绝码。
 * 受控只读 metadata getter仅观察实际函数次序，不模拟玩家权威，不调用 World／游戏或快照写方。
 * 不创建文件、不跑模型，不用生产结算生成预期，也不重新生成现有 golden。
 */
import { expect, test } from "bun:test";
import { verifyReproductionMechanisms } from "../../../src/recording/verification/assembly";
import {
  parseReproductionRecord,
  type ReproductionRecord,
  type ReproductionMetadata,
} from "../../../src/recording/reproduction/format";
import { Role, Camp, Phase, WinCondition } from "@ai-werewolf-arena/game-contract";

function archive(): ReproductionRecord {
  const roles = [Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer, Role.Guard];
  const players = roles.map((role, index) => ({
    id: index + 1,
    name: `literal-${index + 1}`,
    role,
    camp: role === Role.Wolf ? Camp.Wolf : Camp.Good,
  }));
  return {
    schemaVersion: 2,
    finalized: false,
    metadata: {
      engine: { id: "awa-engine", sourceHash: "1".repeat(64), lockHash: "2".repeat(64) },
      random: {
        seed: "literal-record",
        algorithm: "mulberry32-fnv1a-utf16-v1",
        streamPolicy: "named-path-v1",
        path: [],
      },
      ruleset: { id: "awa_classic", version: "1.0.0" },
      boardId: "literal-six",
      locale: "en",
      maxDays: 4,
      dealMode: "fixed",
      normalizedBoard: {
        boardSize: 6,
        enableSheriff: false,
        winConditions: [WinCondition.SlaughterCity, WinCondition.WolfReachHalf],
        hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
        roleSetups: [
          { role: Role.Wolf, count: 2 },
          { role: Role.Villager, count: 2 },
          { role: Role.Seer, count: 1 },
          { role: Role.Guard, count: 1 },
        ],
      },
      players,
    },
    checkpoints: [
      {
        cycle: 0,
        complete: true,
        eventCount: 0,
        snapshot: { day: 1, phase: Phase.Night, gameOver: false, result: null },
        players: players.map((player, index) => ({
          ...player,
          seat: index + 1,
          alive: true,
          privateState: {},
          victory: { affiliations: [{ kind: "faction" as const, faction: player.camp }] },
          vote: { weight: 1, canVote: true },
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

const expectedOrder = [
  "validateInitialIdentityRecord",
  "validateWildChildRecord",
  "validateLonelyGirlRecord",
  "validateGhostBrideRecord",
  "validateAnimalDreamRecord",
  "validateFragrantPairRecord",
  "validateNobleSecretBodyRecord",
  "validateRedMoonRecord",
  "validateDemonHunterRecord",
  "validateScholarMentorRecord",
  "validateMistRavenRecord",
  "validateRadiantEclipseRecord",
  "validateTimeConsortRecord",
  "validateWolfSorcererRecord",
  "validateTricksterRecord",
  "validateMagicianRecord",
  "validateOrderPrinceRecord",
  "validateCupidRecord",
  "validateHybridRecord",
  "validateDeathHistoryRecord",
  "validateCrowRecord",
  "validateSilenceElderRecord",
  "validateAwakenedClawRecord",
  "validateAwakenedWitchRecord",
  "validateWardenRecord",
  "validateAwakenedDayRolesRecord",
  "validateAwakenedDarkStarsRecord",
];
function observeMetadata(record: ReproductionRecord) {
  const original = record.metadata,
    trace: string[] = [];
  Object.defineProperty(record, "metadata", {
    configurable: true,
    get(): ReproductionMetadata {
      const frame = new Error().stack?.match(/at (validate[A-Za-z]+Record)\s*\(/)?.[1];
      if (frame && trace[trace.length - 1] !== frame) trace.push(frame);
      return original;
    },
  });
  return trace;
}

test("all actual mechanism auditors execute in the frozen order including the nested RedMoon dependency", () => {
  const record = archive(),
    trace = observeMetadata(record);
  expect(() => verifyReproductionMechanisms(record)).not.toThrow();
  expect(trace).toEqual(expectedOrder);
});

test("the real parser consumes the complete assembly after valid envelope admission", () => {
  const record = archive(),
    parsed = parseReproductionRecord(record);
  expect(parsed).toEqual(record);
  expect(parsed).not.toBe(record);
  record.checkpoints[0]!.players[0]!.privateState.wildChild = { status: "pending" };
  record.checkpoints[0]!.players[0]!.privateState.lonelyGirl = { remaining: 1 };
  expect(() => parseReproductionRecord(record)).toThrow("reproduction_wild_child_state_invalid");
});

test("first invalid identity owner stops before all subsequent otherwise-invalid mechanisms", () => {
  const record = archive();
  record.metadata.normalizedBoard.roleSetups.push(
    { role: Role.Thief, count: 1 },
    { role: Role.Shapeshifter, count: 1 },
  );
  record.checkpoints[0]!.players[0]!.privateState.wildChild = { status: "forged" };
  const trace = observeMetadata(record);
  expect(() => verifyReproductionMechanisms(record)).toThrow(
    "reproduction_initial_identity_owners_invalid",
  );
  expect(trace).toEqual(["validateInitialIdentityRecord"]);
});

test("unsupported versions and malformed envelopes reject before a mechanism-specific failure", () => {
  const record = archive();
  record.metadata.normalizedBoard.roleSetups.push(
    { role: Role.Thief, count: 1 },
    { role: Role.Shapeshifter, count: 1 },
  );
  expect(() => parseReproductionRecord({ ...record, schemaVersion: 99 })).toThrow(
    "reproduction_schema_not_supported",
  );
  expect(() => parseReproductionRecord({ ...record, decisions: [{ invalid: true }] })).toThrow(
    "reproduction_record_invalid",
  );
});
