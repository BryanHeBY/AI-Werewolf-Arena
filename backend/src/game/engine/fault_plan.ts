import { types } from "node:util";
import { z } from "zod";
import {
  COMPONENT,
  aliveLifeVersion,
  aliveLifeDescriptor,
  createAliveComponent,
  type AliveComponent,
  type World,
} from "../../core";

const nativePromiseThen = Promise.prototype.then;
const nativePromiseSpecies = Object.getOwnPropertyDescriptor(Promise, Symbol.species)?.get;
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
function inputData(value: unknown, seen = new Set<object>(), depth = 0): unknown {
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
      result[key] = inputData(descriptor.value, seen, depth + 1);
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
  return deepFreeze(faultPlanSchema.parse(inputData(value)));
}
export interface FaultDecisionBoundary {
  readonly actorId: number;
  readonly day: number;
  readonly stage: "demon_hunter";
  readonly turn: 1;
  readonly targetId: number;
}
export interface AppliedFault {
  readonly step: FaultStep;
  readonly originalVersion: number;
  readonly replacementVersion: number;
}

/** Explicit offline input; cancellation facts are never consulted to execute a fault. */
export class NightFaultPlan {
  readonly plan: FaultPlan;
  private readonly consumed = new Set<string>();
  private lastDay = 0;
  private failed = false;
  constructor(
    private readonly world: World,
    input: unknown,
  ) {
    this.plan = readFaultPlan(input);
    for (const step of this.plan.steps)
      if (
        !world.hasEntity(step.at.afterDecision.actorId) ||
        !world.hasEntity(step.mutation.playerId)
      )
        throw new Error("fault_plan_player_unknown");
  }

  /** Caller supplies an actual committed choice, before any source in this wave writes Alive. */
  applyBeforeNightSourceFreeze(
    day: number,
    decision: FaultDecisionBoundary | null,
    recordApplied: (fault: AppliedFault) => void,
  ): readonly string[] {
    if (this.failed) throw new Error("fault_plan_failed");
    try {
      return this.apply(day, decision, recordApplied);
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }

  private apply(
    day: number,
    decision: FaultDecisionBoundary | null,
    recordApplied: (fault: AppliedFault) => void,
  ): readonly string[] {
    if (
      typeof recordApplied !== "function" ||
      types.isProxy(recordApplied) ||
      types.isAsyncFunction(recordApplied) ||
      types.isGeneratorFunction(recordApplied)
    )
      throw new Error("fault_plan_recorder_invalid");
    if (!Number.isSafeInteger(day) || day < 1 || day <= this.lastDay)
      throw new Error("fault_plan_boundary_repeated");
    if (this.plan.steps.some((step) => step.at.day < day && !this.consumed.has(step.id)))
      throw new Error("fault_plan_boundary_missed");
    const step = this.plan.steps.find((item) => item.at.day === day);
    if (!step) {
      this.lastDay = day;
      return [];
    }
    if (decision !== null)
      decision = z
        .strictObject({
          actorId: positive,
          day: positive.min(2),
          stage: z.literal("demon_hunter"),
          turn: z.literal(1),
          targetId: positive,
        })
        .parse(inputData(decision));
    if (
      !decision ||
      decision.targetId === decision.actorId ||
      !this.world.hasEntity(decision.targetId) ||
      decision.day !== day ||
      decision.actorId !== step.at.afterDecision.actorId ||
      decision.stage !== step.at.afterDecision.stage ||
      decision.turn !== step.at.afterDecision.turn ||
      ![decision.actorId, decision.targetId].includes(step.mutation.playerId)
    )
      throw new Error("fault_plan_decision_boundary_invalid");
    const original = this.world.getComponent<AliveComponent>(
        step.mutation.playerId,
        COMPONENT.Alive,
      ),
      originalVersion = original && aliveLifeVersion(original);
    if (!original || types.isProxy(original) || originalVersion === undefined)
      throw new Error("fault_plan_original_life_invalid");
    const originalDescriptor = aliveLifeDescriptor(original),
      currentDescriptor = Object.getOwnPropertyDescriptor(original, "alive");
    if (
      !originalDescriptor ||
      !currentDescriptor ||
      currentDescriptor.get !== originalDescriptor.get ||
      currentDescriptor.set !== originalDescriptor.set ||
      currentDescriptor.enumerable !== originalDescriptor.enumerable ||
      currentDescriptor.configurable !== originalDescriptor.configurable
    )
      throw new Error("fault_plan_original_life_invalid");
    if (original.alive !== true) throw new Error("fault_plan_original_life_invalid");
    const replacement = createAliveComponent(true, this.world.locale);
    this.world.addComponent(step.mutation.playerId, COMPONENT.Alive, replacement);
    this.consumed.add(step.id);
    this.lastDay = day;
    const result: unknown = recordApplied({
      step,
      originalVersion,
      replacementVersion: aliveLifeVersion(replacement)!,
    });
    if (result !== undefined) {
      if (
        types.isPromise(result) &&
        !types.isProxy(result) &&
        Object.getPrototypeOf(result) === Promise.prototype &&
        !Object.hasOwn(result, "constructor") &&
        Object.getOwnPropertyDescriptor(Promise.prototype, "constructor")?.value === Promise &&
        Object.getOwnPropertyDescriptor(Promise, Symbol.species)?.get === nativePromiseSpecies
      )
        nativePromiseThen.call(result, undefined, () => undefined);
      throw new Error("fault_plan_recorder_not_sync");
    }
    return Object.freeze([step.id]);
  }

  assertConsumed(): void {
    if (this.failed) throw new Error("fault_plan_failed");
    if (this.consumed.size !== this.plan.steps.length) throw new Error("fault_plan_unconsumed");
  }
}
