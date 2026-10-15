/**
 * 包级单元测试验证盗贼有限发牌与身份传输记录。
 * 独立牌堆和槽位字面预期核对白名单、copier 的 130 项上限、角色／阵营关联及保留盗贼的可空选择。
 * 不抽 RNG、不安装牌堆或转换角色；格式通过不授予身份选择能力。
 */
import { expect, test } from "bun:test";
import {
  THIEF_EVENT_TYPES,
  readThiefEventFact,
} from "@ai-werewolf-arena/game-contract/facts/thief";
const policy = "lui_meme_thief_two_extra_villagers_v1";
test("the 128-seat declared shape retains its 130-card copy bound", () => {
  expect<unknown>(THIEF_EVENT_TYPES).toEqual(["thief_initial_deal", "thief_identity_chosen"]);
  const roles = ["thief", "wolf", "wolf", ...Array(127).fill("villager")],
    row = { policy, boardSize: 128, roles };
  expect<unknown>(readThiefEventFact("thief_initial_deal", row)).toEqual(row);
  expect(
    readThiefEventFact("thief_initial_deal", {
      ...row,
      roles: [...roles, "villager"],
      boardSize: 129,
    }),
  ).toBeNull();
  expect(
    readThiefEventFact("thief_initial_deal", {
      ...row,
      roles: ["awakened_knight", ...roles.slice(1)],
    }),
  ).toBeNull();
});
test("nullable native thief slot and selected wolf camp remain correlated", () => {
  const base = { policy, actorId: Number.MAX_SAFE_INTEGER, day: 1 };
  expect(
    readThiefEventFact("thief_identity_chosen", {
      ...base,
      slot: null,
      role: "thief",
      camp: "good",
    }),
  ).not.toBeNull();
  expect(
    readThiefEventFact("thief_identity_chosen", { ...base, slot: 0, role: "wolf", camp: "wolf" }),
  ).not.toBeNull();
  for (const extra of [
    { slot: null, role: "wolf", camp: "wolf" },
    { slot: 0, role: "thief", camp: "good" },
    { slot: 1, role: "wolf", camp: "good" },
  ])
    expect(readThiefEventFact("thief_identity_chosen", { ...base, ...extra })).toBeNull();
});
test("unknown events and accessor input return null without getter execution", () => {
  let reads = 0;
  const row = {
    policy,
    actorId: 1,
    day: 1,
    slot: 0,
    role: "wolf",
    get camp() {
      reads++;
      return "wolf";
    },
  };
  expect(readThiefEventFact("unknown", row)).toBeNull();
  expect(readThiefEventFact("thief_identity_chosen", row)).toBeNull();
  expect(reads).toBe(0);
});
