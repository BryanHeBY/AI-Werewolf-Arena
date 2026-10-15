/**
 * 负责觉醒女巫纯历史契约的单元测试；输入为独立字面三轮协作与恶意变体，预期来自规则卡真值表。
 * 验证资源只随建立消耗、否决不退款、协助资格不复用、半成品不伪造一致，以及本人摘要不泄露秘密。
 */
import { expect, test } from "bun:test";
import {
  AWAKENED_WITCH_POLICY as policy,
  readAwakenedWitchStateData,
  awakenedWitchResources,
} from "../src/facts/awakened-witch";

function history() {
  return {
    policy,
    nights: [
      {
        day: 1,
        mode: "poison",
        ordinal: 1,
        targetId: 9,
        assistantIds: [3],
        discussions: [{ actorId: 3, text: "" }],
        approvals: [{ actorId: 3, approve: true }],
        outcome: "poison",
      },
      { day: 2, mode: "heal", targetId: 5 },
      {
        day: 3,
        mode: "poison",
        ordinal: 2,
        targetId: 8,
        assistantIds: [4, 5],
        discussions: [
          { actorId: 4, text: "  私有原文 {target}\n🐺 " },
          { actorId: 5, text: "No" },
        ],
        approvals: [
          { actorId: 5, approve: false },
          { actorId: 4, approve: true },
        ],
        outcome: "vetoed",
      },
      { day: 4, mode: "pass" },
      {
        day: 5,
        mode: "poison",
        ordinal: 3,
        targetId: 1,
        assistantIds: [6, 7, 8],
        discussions: [],
        approvals: [],
        outcome: "building",
      },
    ],
  };
}
test("三轮建立即耗尽调毒，否决与尚未收齐均不退款；摘要不带协助结果或发言", () => {
  const input = history(),
    state = readAwakenedWitchStateData(input)!;
  expect<unknown>(state).toEqual(input);
  expect(state).not.toBe(input);
  expect(state.nights[2]).not.toBe(input.nights[2]);
  expect(awakenedWitchResources(state)).toEqual({
    healRemaining: 0,
    brewRemaining: 0,
    usedAssistantIds: [3, 4, 5, 6, 7, 8],
  });
  expect(JSON.stringify(awakenedWitchResources(state))).not.toContain("approve");
  expect(JSON.stringify(awakenedWitchResources(state))).not.toContain("私有原文");
});
test("初态与明确空过不消费；一瓶解药最多建立一次", () => {
  const empty = readAwakenedWitchStateData({ policy, nights: [] })!;
  expect(awakenedWitchResources(empty)).toEqual({
    healRemaining: 1,
    brewRemaining: 3,
    usedAssistantIds: [],
  });
  expect(
    awakenedWitchResources(
      readAwakenedWitchStateData({ policy, nights: [{ day: 1, mode: "pass" }] })!,
    ),
  ).toEqual(awakenedWitchResources(empty));
  const input = history();
  input.nights.pop();
  expect(readAwakenedWitchStateData(input)).not.toBeNull();
  input.nights.push({ day: 6, mode: "heal", targetId: 7 });
  expect(readAwakenedWitchStateData(input)).toBeNull();
});
test("重用协助者、缩小第k次人数、伪造库存或第四轮均拒绝", () => {
  const reuse = history();
  reuse.nights[4]!.assistantIds = [3, 7, 8];
  expect(readAwakenedWitchStateData(reuse)).toBeNull();
  const shortage = history();
  shortage.nights[4]!.assistantIds = [6, 7];
  expect(readAwakenedWitchStateData(shortage)).toBeNull();
  expect(readAwakenedWitchStateData({ ...history(), brewRemaining: 3 })).toBeNull();
  const fourth = history();
  fourth.nights[4]!.discussions = [6, 7, 8].map((actorId) => ({ actorId, text: "" }));
  fourth.nights[4]!.approvals = [6, 7, 8].map((actorId) => ({ actorId, approve: true }));
  fourth.nights[4]!.outcome = "poison";
  expect(readAwakenedWitchStateData(fourth)).not.toBeNull();
  fourth.nights.push({ ...fourth.nights[4]!, day: 6, ordinal: 4, assistantIds: [9, 10, 11, 12] });
  expect(readAwakenedWitchStateData(fourth)).toBeNull();
});
test("未完成协作与明确否决有不同数据状态，不能补默认同意或伪造毒已生效", () => {
  const premature = history();
  premature.nights[4]!.outcome = "poison";
  expect(readAwakenedWitchStateData(premature)).toBeNull();
  const veto = history();
  veto.nights[2]!.outcome = "poison";
  expect(readAwakenedWitchStateData(veto)).toBeNull();
  const falseVeto = history();
  falseVeto.nights[0]!.outcome = "vetoed";
  expect(readAwakenedWitchStateData(falseVeto)).toBeNull();
});
test("讨论必须按冻结成员顺序，每人仅决定一次且全讨论先于决定", () => {
  const reversed = history();
  reversed.nights[2]!.discussions!.reverse();
  expect(readAwakenedWitchStateData(reversed)).toBeNull();
  const duplicate = history();
  duplicate.nights[2]!.approvals![0]!.actorId = 4;
  expect(readAwakenedWitchStateData(duplicate)).toBeNull();
  const early = history();
  early.nights[4]!.approvals = [{ actorId: 6, approve: true }];
  expect(readAwakenedWitchStateData(early)).toBeNull();
});
test("相同夜不能二次选择，访问器不执行，原文和返回副本互不污染", () => {
  const repeated = history();
  repeated.nights[3]!.day = 3;
  expect(readAwakenedWitchStateData(repeated)).toBeNull();
  let reads = 0;
  expect(
    readAwakenedWitchStateData({
      policy,
      get nights() {
        reads++;
        throw Error("unexpected_getter");
      },
    }),
  ).toBeNull();
  expect(reads).toBe(0);
  const input = history(),
    state = readAwakenedWitchStateData(input)!;
  input.nights[2]!.discussions![0]!.text = "changed";
  const third = state.nights[2]!;
  if (third.mode !== "poison") throw Error("literal_expected_third_night_poison");
  expect(third.discussions[0]!.text).toBe("  私有原文 {target}\n🐺 ");
});
