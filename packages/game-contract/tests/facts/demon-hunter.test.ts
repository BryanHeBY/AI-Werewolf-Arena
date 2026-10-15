/**
 * 包级单元测试验证猎魔人完整／本人事实、历史和工具 DTO。
 * 独立字面行与畸形矩阵核对信息披露、政策 ID、日期／取消限制及历史和工具形状；此处状态是序列化历史，不是可用库存。
 * 解析不扣狩猎资源或授予行动许可；Node 敌对 Proxy 防护仍由外层负责，不执行引擎或规则预期生成器。
 */
import { expect, test } from "bun:test";
import {
  DEMON_HUNTER_POLICY,
  DEMON_HUNTER_EVENT_TYPES,
  readDemonHunterEventFact,
  readDemonHunterPlayerFact,
  readDemonHunterState,
  readDemonHuntTool,
} from "@ai-werewolf-arena/game-contract/facts/demon-hunter";

const chosen = "demon_hunter_chosen",
  cancelled = "demon_hunter_cancelled",
  immune = "demon_hunter_poison_immune";
test("policy/event IDs and full versus own choice keep their exact disclosure", () => {
  expect(DEMON_HUNTER_POLICY).toBe("awa_netease_demon_hunter_v1");
  expect(DEMON_HUNTER_EVENT_TYPES).toEqual([chosen, cancelled, immune]);
  const full = { policy: DEMON_HUNTER_POLICY, actorId: 4, day: 2, targetId: 3 },
    own = { policy: DEMON_HUNTER_POLICY, day: 2, targetId: 3 };
  const fact = readDemonHunterEventFact(chosen, full)!;
  expect(fact).toEqual(full);
  expect(fact).not.toBe(full);
  expect(Object.getPrototypeOf(fact)).toBeNull();
  expect(readDemonHunterPlayerFact(chosen, own)).toEqual(own);
  expect(readDemonHunterPlayerFact(chosen, full)).toBeNull();
  expect(readDemonHunterEventFact(chosen, own)).toBeNull();
  expect(readDemonHunterPlayerFact(immune, own)).toBeNull();
  expect(readDemonHunterPlayerFact(cancelled, own)).toBeNull();
  expect(readDemonHunterEventFact(chosen, { ...full, day: 1 })).toBeNull();
  expect(readDemonHunterEventFact(chosen, { ...full, targetId: 4 })).toBeNull();
  expect(readDemonHunterPlayerFact(chosen, { ...own, targetId: null })).not.toBeNull();
});

test("cancellation preserves nullable fault ID and its original 128-character upper bound", () => {
  const base = {
    policy: DEMON_HUNTER_POLICY,
    actorId: 4,
    day: 2,
    targetId: 3,
    reason: "authority_revoked",
  };
  for (const faultId of [null, "fault-original", "x".repeat(128)])
    expect(readDemonHunterEventFact(cancelled, { ...base, faultId })).toEqual({ ...base, faultId });
  for (const faultId of [undefined, "", "x".repeat(129), 1])
    expect(readDemonHunterEventFact(cancelled, { ...base, faultId })).toBeNull();
  expect(readDemonHunterEventFact(cancelled, { ...base, faultId: null, day: 1 })).toBeNull();
  expect(
    readDemonHunterEventFact(cancelled, { ...base, faultId: null, reason: "runtime_error" }),
  ).toBeNull();
});

test("poison immunity permits day one but reveals only its exact full event fields", () => {
  const value = { policy: DEMON_HUNTER_POLICY, actorId: 4, day: 1, witchId: 3 };
  expect(readDemonHunterEventFact(immune, value)).toEqual(value);
  expect(readDemonHunterEventFact(immune, { ...value, witchId: 4 })).toBeNull();
  expect(readDemonHunterEventFact(immune, { ...value, targetId: 3 })).toBeNull();
  expect(
    readDemonHunterPlayerFact(immune, { policy: DEMON_HUNTER_POLICY, day: 1, targetId: null }),
  ).toBeNull();
});

test("history DTO preserves strict ascending post-first-night rows and detached data", () => {
  const value = {
    policy: DEMON_HUNTER_POLICY,
    history: [
      { day: 2, targetId: null },
      { day: 4, targetId: 3 },
    ],
  };
  const state = readDemonHunterState(value)!;
  expect(state).toEqual(value);
  expect(state.history).not.toBe(value.history);
  expect(state.history[1]).not.toBe(value.history[1]);
  for (const history of [
    [{ day: 1, targetId: 3 }],
    [
      { day: 2, targetId: 3 },
      { day: 2, targetId: null },
    ],
    [
      { day: 3, targetId: 3 },
      { day: 2, targetId: null },
    ],
    [{ day: 2, targetId: 3, paid: true }],
  ])
    expect(readDemonHunterState({ policy: DEMON_HUNTER_POLICY, history })).toBeNull();
  expect(readDemonHunterState({ policy: DEMON_HUNTER_POLICY, history: [] })).not.toBeNull();
  expect(readDemonHunterState({ ...value, remaining: 1 })).toBeNull();
});

test("tool DTO keeps exact null-pass versus numeric-target booleans without granting permission", () => {
  for (const args of [
    { target_id: null, abstain: true },
    { target_id: 3, abstain: false },
  ])
    expect(readDemonHuntTool({ name: "demon_hunt", args })).toEqual({ name: "demon_hunt", args });
  for (const args of [
    { target_id: null, abstain: false },
    { target_id: 3, abstain: true },
    { target_id: 3, abstain: "false" },
    { target_id: 3, abstain: false, turn_id: "extra" },
  ])
    expect(readDemonHuntTool({ name: "demon_hunt", args })).toBeNull();
  expect(readDemonHuntTool({ name: "other", args: { target_id: 3, abstain: false } })).toBeNull();
});

test("inclusive integer edge, history length and accessor limits retain original null rejection", () => {
  const max = Number.MAX_SAFE_INTEGER;
  expect(
    readDemonHunterEventFact(chosen, {
      policy: DEMON_HUNTER_POLICY,
      actorId: max,
      day: max,
      targetId: null,
    }),
  ).not.toBeNull();
  expect(
    readDemonHuntTool({ name: "demon_hunt", args: { target_id: max, abstain: false } }),
  ).not.toBeNull();
  const history = Array.from({ length: 128 }, (_, index) => ({ day: index + 2, targetId: null }));
  expect(readDemonHunterState({ policy: DEMON_HUNTER_POLICY, history })).not.toBeNull();
  expect(
    readDemonHunterState({
      policy: DEMON_HUNTER_POLICY,
      history: [...history, { day: 130, targetId: null }],
    }),
  ).toBeNull();
  let reads = 0;
  const value = {
    policy: DEMON_HUNTER_POLICY,
    actorId: 4,
    day: 2,
    get targetId() {
      reads++;
      return 3;
    },
  };
  expect(readDemonHunterEventFact(chosen, value)).toBeNull();
  expect(reads).toBe(0);
});
