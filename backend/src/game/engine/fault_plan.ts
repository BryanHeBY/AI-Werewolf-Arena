/**
 * 负责在声明的决策与来源冻结边界执行显式夜间故障计划。输入为计划描述与当前 World 引用；
 * 输出保留实际故障及计划消费检查。这个受控故障驱动不创造正常角色动作，也不改变 RNG 抽取顺序。
 */
import { createAliveComponent } from "../observation/component-presentation";
import { types } from "node:util";
import { z } from "zod";
import { readFaultPlan, type FaultPlan, type FaultStep } from "../../core/domain/fault_plan";
export { readFaultPlan, type FaultPlan, type FaultStep } from "../../core/domain/fault_plan";
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
function inputData(value: unknown): unknown {
  // Decision boundary is equally finite plain data; use the core snapshot helper.
  return readFaultPlanData(value);
}
import { readFaultPlanData } from "../../core/domain/fault_plan";
import { COMPONENT, aliveLifeVersion, aliveLifeDescriptor, type AliveComponent, type World } from "../../core";

const nativePromiseThen = Promise.prototype.then;
const nativePromiseSpecies = Object.getOwnPropertyDescriptor(Promise, Symbol.species)?.get;
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
    const original = this.world.getComponent(step.mutation.playerId, COMPONENT.Alive),
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
