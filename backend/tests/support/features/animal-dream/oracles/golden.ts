/**
 * 持有本模块手写测试预期和有界契约断言；输入为提供的计划或观察元组，输出保留字面库存、身份、标记及错误预期。不从生产结算重新生成预期游戏结果，也不运行游戏、模型或传输。
 */
import type { AnimalPlan } from "../contracts";
import { Camp } from "../../../../../src/domain";

export function animalGolden(name: AnimalPlan, skip = false, first = false) {
  const g = {
    fox_beauty: {
      winner: Camp.Good,
      alive: [5, 9, 10, 11, 12],
      night: [[], [], [6], [8]],
      days: 4,
    },
    cat_badge: { winner: Camp.Good, alive: [5, 10, 11, 12], night: [[], [6], [7], [8]], days: 4 },
    puffer_knife: {
      winner: Camp.Good,
      alive: [5, 6, 7, 11],
      night: [[12], [10], [], [8]],
      days: 4,
    },
    pk: first
      ? { winner: Camp.Good, alive: [7, 8, 9, 10, 11, 12], night: [[], [5], [6]], days: 3 }
      : { winner: Camp.Good, alive: [7, 8, 11, 12], night: [[], [5], [6], [], [10]], days: 5 },
    last_chain: { winner: Camp.Wolf, alive: [5, 6, 7, 8], night: [[], [10], [11], []], days: 4 },
    full_retaliation: { winner: Camp.Wolf, alive: [9], night: [[]], days: 1 },
  };
  return g[name];
}
