/**
 * 单元测试以原导入板子及五种字面字段变体为输入，核对 Fragrant 有限预设仅接受原生名单与固定来源政策。精确接受基线和拒绝变体为预期；不创建 World、周期、文件系统或模型。
 */
import { expect, test } from "bun:test";
import { fragrantPairSeerTwelveConfig } from "../../../src/rulesets/presets/fragrant-pair-seer-twelve";
import { isFragrantPairSeerPreset } from "../../../src/rulesets";

test("finite preset accepts only its native roster and fixed source policies", () => {
  expect(isFragrantPairSeerPreset(fragrantPairSeerTwelveConfig)).toBe(true);
  for (const changed of [
    { boardSize: 10 },
    { guard: { repeatPolicy: "awa_last_action_v1" } },
    { witch: { ...fragrantPairSeerTwelveConfig.witch, canSelfHeal: "first_night_only" } },
    { seer: { targetPolicy: "awa_alive_v1" } },
    { mistRaven: { policy: "awa_mist_raven_v1" } },
  ])
    expect(isFragrantPairSeerPreset({ ...fragrantPairSeerTwelveConfig, ...changed })).toBe(false);
});
