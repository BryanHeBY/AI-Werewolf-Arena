import { types } from "node:util";
import { z } from "zod";

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
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

/** Read data descriptors only; an offline fault input must never execute user code. */
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
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string"))
      throw new Error("fault_plan_input_invalid");
    const result: Record<string, unknown> = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (key === "__proto__" || !("value" in descriptor) || !descriptor.enumerable)
        throw new Error("fault_plan_input_invalid");
      result[key] = readFaultPlanData(descriptor.value, seen, depth + 1);
    }
    if (!array) return result;
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
    seen.delete(value);
  }
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
export function readFaultPlan(value: unknown): FaultPlan {
  return deepFreeze(faultPlanSchema.parse(readFaultPlanData(value)));
}
