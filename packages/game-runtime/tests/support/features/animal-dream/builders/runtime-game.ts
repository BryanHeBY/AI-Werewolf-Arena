/**
 * 持有动物梦境测试的固定身份表、按 skip／first 构造的板子及 animalGame 初始化入口。初始化接收 locale 和两个策略标志，使用内部固定种子及身份建立真实 bootstrap 对象；仅初始化，不推进阶段或从运行结果生成预期。
 */
import { Role } from "../../../../../src/domain";
import { animalDreamTwelveConfig } from "../../../../../src/rulesets/presets/animal-dream-twelve";
import type { BoardConfig } from "../../../../../src/domain";
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { createRandom } from "../../../../../src/domain";

export const animalRoles = [
  Role.WolfBeauty,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.WhiteCat,
  Role.FoxCub,
  Role.Bear,
  Role.Pufferfish,
];

export function animalBoard(skip = false, first = false): BoardConfig {
  return {
    ...animalDreamTwelveConfig,
    whiteCat: {
      skippedVotePolicy: skip ? "awa_expire_on_skipped_day_v1" : "awa_wait_for_actual_exile_v1",
    },
    pufferfish: { ballotPolicy: first ? "awa_first_ballot_v1" : "awa_final_ballot_v1" },
  };
}

export function animalGame(locale: "zh-CN" | "en" = "zh-CN", skip = false, first = false) {
  return bootstrapGame(animalBoard(skip, first), {
    fixedRoles: animalRoles,
    locale,
    random: createRandom("animal-literal-v1"),
  });
}
