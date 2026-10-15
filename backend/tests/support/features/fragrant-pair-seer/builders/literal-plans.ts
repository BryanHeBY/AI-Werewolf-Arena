/**
 * 持有寻香测试逐夜手写行动表 fragrantLiteralPlans；以计划名索引各夜绑定、刀、药及放逐等原字面字段。此文件只导出表，由调用方驱动和检查消费；不接受构造器参数，不执行对局或从生产结果生成该表。
 */
import type { FragrantRuntimePlan } from "../contracts";

export const fragrantLiteralPlans: Record<string, readonly FragrantRuntimePlan[]> = {
  inherited_gun: [
    { bind: null, knife: 9, poison: 2, exile: 3 },
    { bind: null, knife: 10, exile: 4 },
    { bind: [1, 12], knife: 11, shoot: 1 },
  ],
  first_link: [
    { bind: [5, 6], knife: 5, exile: 2 },
    { knife: 7, exile: 3 },
    { knife: 8, exile: 4 },
  ],
  expiry: [
    { bind: [5, 6], knife: null, exile: 2 },
    { bind: null, knife: 7, exile: 3 },
    { bind: [5, 6], knife: 5, exile: 4 },
    { knife: null, exile: 1 },
  ],
};
