/**
 * 单元测试负责权威事实流的独立字面契约验收。输入为连续与篡改的双游标数据，预期明确区分
 * 历史无覆盖、新档空流、越界／倒退与不完整保护归因，不运行游戏规则或生成事实预期。
 */
import { expect, test } from "bun:test";
import { type ReplayFact, readReplayFact, readReplayFacts, readReplayFactLog } from "../src/index";
const facts: ReplayFact[] = [
  {
    seq: 1,
    afterSeq: 0,
    day: 1,
    kind: "potion_stock",
    actorId: 3,
    abilityId: "native:potion",
    heal: 1,
    poison: 1,
  },
  {
    seq: 2,
    afterSeq: 4,
    day: 1,
    kind: "wolf_knife_committed",
    participantIds: [1, 2],
    requestedTargetId: 4,
    effectiveTargetId: 5,
  },
  {
    seq: 3,
    afterSeq: 4,
    day: 1,
    kind: "night_protection_resolved",
    targetId: 5,
    interaction: "guard_heal_cancelled",
  },
  {
    seq: 4,
    afterSeq: 5,
    day: 1,
    kind: "night_protection_resolved",
    targetId: 6,
    interaction: "wolf_attack_blocked",
    protection: "heal",
  },
  {
    seq: 5,
    afterSeq: 5,
    day: 1,
    kind: "life_committed",
    playerId: 5,
    alive: false,
    causes: ["wolf_kill"],
  },
];
test("God事实流保双游标和精确归因，脱离原输入", () => {
  const parsed = readReplayFacts(facts, 5);
  expect(parsed).toEqual(facts);
  parsed[1]!.afterSeq = 0;
  expect(facts[1]!.afterSeq).toBe(4);
  expect(readReplayFactLog({}, 0)).toBeUndefined();
  expect(readReplayFactLog({ factCoverage: { committedDeaths: 1 }, facts: [] }, 0)).toEqual({
    factCoverage: { committedDeaths: 1 },
    facts: [],
  });
});
test("拒绝覆盖伪装、双游标缺口／倒退／越界与未知成功徽章", () => {
  for (const [bad, path] of [
    [[{ ...facts[0], seq: 2 }], "facts[0]"],
    [[{ ...facts[0], afterSeq: 6 }], "facts[0]"],
    [
      [
        { ...facts[0], afterSeq: 3 },
        { ...facts[1], afterSeq: 2 },
      ],
      "facts[1]",
    ],
    [[{ ...facts[0], kind: "unproven_success" }], "facts[0]"],
    [[{ ...facts[3], seq: 1, protection: undefined }], "facts[0]"],
    [[{ ...facts[2], seq: 1, protection: "heal" }], "facts[0]"],
    [[{ ...facts[4], seq: 1, alive: true }], "facts[0]"],
  ] as const)
    expect(() => readReplayFacts(bad, 5)).toThrow(path);
  expect(() => readReplayFactLog({ facts: [] }, 0)).toThrow("factCoverage");
  expect(() => readReplayFactLog({ factCoverage: { committedDeaths: 1 } }, 0)).toThrow("facts");
});
test("事实字段与数组访问器不能伪装为序列化数据", () => {
  let reads = 0;
  const unsafe = { ...facts[1], participantIds: [1, 2] };
  Object.defineProperty(unsafe.participantIds, "0", {
    get() {
      reads++;
      return 1;
    },
    enumerable: true,
  });
  expect(readReplayFact(unsafe)).toBeNull();
  expect(reads).toBe(0);
});
test("可选真实waveId兼容旧生命事实，显式畸形编号和额外字段仍拒绝", () => {
  const old = facts[4]!;
  expect(readReplayFact(old)).toEqual(old);
  expect(readReplayFact({ ...old, waveId: 7 })).toEqual({ ...old, waveId: 7 });
  for (const waveId of [0, -1, 1.5, "1", null, undefined])
    expect(readReplayFact({ ...old, waveId })).toBeNull();
  expect(readReplayFact({ ...facts[0], waveId: 1 })).toBeNull();
});
