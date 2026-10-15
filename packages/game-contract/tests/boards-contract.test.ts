/**
 * 包级单元／类型契约测试验证序列化板子形状和政策标识。
 * 独立字面配置、畸形普通数据及只读 DTO 类型负例核对字段范围和可选性；schema 不补默认值，
 * 也不统计牌数、去重角色或应用胜利目标。格式通过不代表有限板子受支持或取得执行许可；本文件不调用规则与 World。
 */
import { expect, test } from "bun:test";
import {
  Role,
  Camp,
  WinCondition,
  ANIMAL_DREAM_POLICY,
  NIGHTMARE_SHADOW_POLICY,
  EVIL_KNIGHT_POLICY,
  PURE_WHITE_POLICY,
  CAT_SKIPPED_VOTE_POLICIES,
  PUFFER_BALLOT_POLICIES,
  BEAR_SIGNAL_POLICIES,
  DEFAULT_SEER_ACTION_POLICY,
  type BoardConfig,
  type LoversComponent,
} from "@ai-werewolf-arena/game-contract";
import { boardConfigSchema } from "@ai-werewolf-arena/game-contract/board-schema";
import { EVENT_PACK_IDS } from "@ai-werewolf-arena/game-contract/boards";

function classic(): BoardConfig {
  return {
    boardSize: 6,
    enableSheriff: false,
    roleSetups: [
      { role: Role.Wolf, count: 2 },
      { role: Role.Seer, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
    hooks: {
      onDaybreak: false,
      onPreElection: false,
      onPreVote: false,
      onPerSpeechGap: false,
    },
  };
}

test("literal six-seat shape and empty optional objects acquire no defaults", () => {
  const raw = classic();
  expect(boardConfigSchema.parse(raw)).toEqual(raw);
  const optionals = { ...raw, sheriff: {}, witch: {}, tieBreaker: {} };
  expect(boardConfigSchema.parse(optionals)).toEqual(optionals);
  expect(Object.hasOwn(boardConfigSchema.parse(raw), "seer")).toBe(false);
  expect(Object.hasOwn(boardConfigSchema.parse(raw), "winConditions")).toBe(false);
  expect(DEFAULT_SEER_ACTION_POLICY).toBe("awa_required_when_legal_v1");
});

test("shape-only integer endpoints and empty goals preserve the independent support boundary", () => {
  const maximum = { ...classic(), boardSize: 128, roleSetups: [{ role: Role.Wolf, count: 128 }] };
  expect(boardConfigSchema.parse(maximum)).toEqual(maximum);
  const structural = {
    ...classic(),
    roleSetups: [
      { role: Role.Wolf, count: 0 },
      { role: Role.Wolf, count: 1 },
    ],
    winConditions: [],
  };
  // 原 schema 不统计牌堆总量、不去重角色，也不应用胜利目标。
  expect(boardConfigSchema.parse(structural)).toEqual(structural);
});

test("required fields, strict tails, role minimum and count bounds reject unchanged", () => {
  const base = classic();
  const { enableSheriff: _required, ...missing } = base;
  for (const input of [
    missing,
    { ...base, privateState: {} },
    { ...base, boardSize: 0 },
    { ...base, boardSize: 129 },
    { ...base, boardSize: 1.5 },
    { ...base, roleSetups: [] },
    { ...base, roleSetups: [{ role: Role.Wolf, count: -1 }] },
    { ...base, roleSetups: [{ role: Role.Wolf, count: 129 }] },
    { ...base, roleSetups: [{ role: Role.Wolf, count: 1.5 }] },
    { ...base, roleSetups: [{ role: Role.Wolf, count: 2, hidden: true }] },
    { ...base, hooks: { ...base.hooks, extra: true } },
    { ...base, seer: { targetPolicy: "awa_alive_v1" } },
  ])
    expect(boardConfigSchema.safeParse(input).success).toBe(false);
});

test("runtime Role enum remains the 60-member schema boundary while raw JSON IDs still parse", () => {
  const raw = JSON.parse(JSON.stringify(classic()));
  expect(boardConfigSchema.parse(raw).roleSetups[0]!.role).toBe(Role.Wolf);
  expect(Object.values(Role)).toHaveLength(60);
  for (const role of ["awakened_knight", "unregistered_role", "Wolf"])
    expect(boardConfigSchema.safeParse({ ...raw, roleSetups: [{ role, count: 1 }] }).success).toBe(
      false,
    );
});

test("finite-number and option enum errors retain the original strict-shape policy", () => {
  const base = classic();
  for (const voteWeight of [0, -1, Infinity, NaN, "1.5"])
    expect(boardConfigSchema.safeParse({ ...base, sheriff: { voteWeight } }).success).toBe(false);
  expect(
    boardConfigSchema.parse({ ...base, sheriff: { voteWeight: 1.5 } }).sheriff?.voteWeight,
  ).toBe(1.5);
  expect(boardConfigSchema.safeParse({ ...base, winCondition: "unknown_goal" }).success).toBe(
    false,
  );
  expect(
    boardConfigSchema.parse({ ...base, winCondition: WinCondition.SlaughterSide }).winCondition,
  ).toBe(WinCondition.SlaughterSide);
  expect(
    boardConfigSchema.safeParse({ ...base, bear: { signalPolicy: "unknown_policy" } }).success,
  ).toBe(false);
});

test("four policy constants and three ordered arrays keep their original literal and mutability API", () => {
  expect(ANIMAL_DREAM_POLICY).toBe("awa_animal_dream_v1");
  expect(NIGHTMARE_SHADOW_POLICY).toBe("awa_nightmare_dreamer_v1");
  expect(EVIL_KNIGHT_POLICY).toBe("awa_evil_knight_v1");
  expect(PURE_WHITE_POLICY).toBe("awa_pure_white_night_v1");
  expect(CAT_SKIPPED_VOTE_POLICIES).toEqual([
    "awa_wait_for_actual_exile_v1",
    "awa_expire_on_skipped_day_v1",
  ]);
  expect(PUFFER_BALLOT_POLICIES).toEqual(["awa_final_ballot_v1", "awa_first_ballot_v1"]);
  expect(BEAR_SIGNAL_POLICIES).toEqual(["awa_night_open_v1", "netease_dawn_live_v1"]);
  for (const array of [CAT_SKIPPED_VOTE_POLICIES, PUFFER_BALLOT_POLICIES, BEAR_SIGNAL_POLICIES])
    expect(Object.isFrozen(array)).toBe(false);
  expect(EVENT_PACK_IDS).toEqual(["awa_wall_notes_once_v1"]);
});

test("Cupid DTO remains readonly God metadata with enum camps and no runtime handles", () => {
  const relation: LoversComponent = {
    actorId: 7,
    day: 1,
    policy: "netease_2017_cupid_follows_lovers_v1",
    pairIds: [2, 3],
    pairCamps: [Camp.Good, Camp.Wolf],
    groupId: "cupid_lovers",
    mixed: true,
  };
  if (false) {
    // @ts-expect-error Metadata actor identity stays readonly.
    relation.actorId = 8;
    // @ts-expect-error Pair tuples stay readonly.
    relation.pairIds[0] = 8;
    // @ts-expect-error Cupid has the original first-night data unit.
    const laterDay: LoversComponent["day"] = 2;
    // @ts-expect-error Relation camps preserve the original nominal enum subset.
    const thirdParty: LoversComponent["pairCamps"] = [Camp.Good, Camp.ThirdParty];
    // @ts-expect-error String labels do not replace the Camp member types.
    const rawCamps: LoversComponent["pairCamps"] = ["good", "wolf"];
    void [laterDay, thirdParty, rawCamps];
  }
  expect(JSON.parse(JSON.stringify(relation))).toEqual({
    actorId: 7,
    day: 1,
    policy: "netease_2017_cupid_follows_lovers_v1",
    pairIds: [2, 3],
    pairCamps: ["good", "wolf"],
    groupId: "cupid_lovers",
    mixed: true,
  });
});
