/**
 * 以 locale 和 RandomSource 初始化寻香测试的原生游戏对象，默认随机源在模块内指定。输出真实 bootstrap 及既有固定角色／依赖句柄；不把 seed 当调用参数，不推进夜间或替调用方生成结果预期。
 */
import { Role } from "../../../../../src/domain/identity";
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { fragrantPairSeerTwelveConfig } from "../../../../../src/rulesets/presets/fragrant-pair-seer-twelve";
import { createRandom } from "../../../../../src/domain/random";
import type { RandomSource } from "../../../../../src/domain/random";

const fixed = [
  Role.FragrantPhantom,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.AwakenedSeer,
  Role.Witch,
  Role.Hunter,
  Role.Guard,
];

export function fragrantRuntimeGame(
  locale: "zh-CN" | "en" = "zh-CN",
  random: RandomSource = createRandom("fragrant-handwritten-runtime"),
) {
  return bootstrapGame(fragrantPairSeerTwelveConfig, {
    fixedRoles: fixed,
    random,
    locale,
  });
}
