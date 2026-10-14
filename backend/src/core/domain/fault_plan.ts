/**
 * 负责离线故障计划的数据复制、结构校验与冻结；输入外部计划，输出已校验的独立数据。
 * 只接受既有猎魔决策后、夜来源冻结前的替换生命步骤，计划执行和实际 World 写入归引擎。
 * 读取先拒绝 Node Proxy 与访问器，解析失败保原错误；数据计划本身不授予运行身份或行动权限。
 */
import { types } from "node:util";
import { z } from "zod";

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** 字段与机器标识保持既有 v1 协议；这里只定义单步形状，不执行故障。 */
const stepSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  at: z.strictObject({
    day: positive.min(2),
    point: z.literal("before_night_source_freeze"),
    afterDecision: z.strictObject({
      actorId: positive,
      stage: z.literal("demon_hunter"),
      turn: z.literal(1),
    }),
  }),
  mutation: z.strictObject({
    kind: z.literal("replace_alive_component"),
    playerId: positive,
    alive: z.literal(true),
  }),
});
// 每个 id 唯一，步骤日次严格递增；不按输入自动排序或合并重复步骤。
const faultPlanSchema = z
  .strictObject({
    version: z.literal("awa_fault_plan_v1"),
    steps: z.array(stepSchema).min(1).max(16),
  })
  .refine(
    (plan) =>
      new Set(plan.steps.map((step) => step.id)).size === plan.steps.length &&
      plan.steps.every((step, index) => index === 0 || step.at.day > plan.steps[index - 1]!.at.day),
    "fault_plan_order_invalid",
  );
export type FaultPlan = z.infer<typeof faultPlanSchema>;
export type FaultStep = FaultPlan["steps"][number];

/** 按自身数据描述符复制；数值先原样传递，其有限性和业务范围留给后续 schema 校验。 */
export function readFaultPlanData(value: unknown, seen = new Set<object>(), depth = 0): unknown {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (!value || typeof value !== "object" || types.isProxy(value) || depth > 12 || seen.has(value))
    throw new Error("fault_plan_input_invalid");
  seen.add(value);
  try {
    const array = Array.isArray(value),
      prototype = Object.getPrototypeOf(value);
    if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null)
      throw new Error("fault_plan_input_invalid");
    // 普通对象／数组或 null 原型才可读取；获取描述符不执行数据字段 getter。
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string"))
      throw new Error("fault_plan_input_invalid");
    const result: Record<string, unknown> = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      // 这里使用普通赋值建立副本，因此明确拒绝 __proto__，并拒绝访问器和非枚举数据。
      if (key === "__proto__" || !("value" in descriptor) || !descriptor.enumerable)
        throw new Error("fault_plan_input_invalid");
      result[key] = readFaultPlanData(descriptor.value, seen, depth + 1);
    }
    if (!array) return result;
    // 长度至多 64，索引必须完整且没有额外键；稀疏数组不补空位。
    const length = descriptors.length?.value;
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > 64 ||
      Object.keys(result).length !== length ||
      Object.keys(result).some((key) => !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)
    )
      throw new Error("fault_plan_input_invalid");
    return Array.from({ length }, (_, index) => result[index]);
  } finally {
    // 只清本次进入的递归路径，失败同样清理；重复的非循环子对象可分别复制。
    seen.delete(value);
  }
}
/** 仅对已复制并通过 schema 的值递归冻结，不触碰调用方原对象。 */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
/** 严格按复制 → schema parse → 深冻结执行；任一步抛错即停止，未执行任何故障步骤。 */
export function readFaultPlan(value: unknown): FaultPlan {
  return deepFreeze(faultPlanSchema.parse(readFaultPlanData(value)));
}
