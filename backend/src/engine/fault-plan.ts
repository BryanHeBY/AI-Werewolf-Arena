/**
 * 负责在声明的猎魔来源冻结或贵族请求返回边界执行显式离线故障计划。输入为计划描述与当前 World 引用；
 * 输出保留实际故障及计划消费检查。这个受控故障驱动不创造正常角色动作，也不改变 RNG 抽取顺序。
 */
import { createAliveComponent } from "../agents/observation/component-presentation";
import { types } from "node:util";
import { z } from "zod";
import {
  readFaultPlan,
  type FaultPlan,
  type FaultStep,
  type NobleRequestFaultStep,
} from "../domain/fault-plan";
export { readFaultPlan, type FaultPlan, type FaultStep } from "../domain/fault-plan";
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
function inputData(value: unknown): unknown {
  // 决策边界同样只接收有限纯数据；复用 core 的快照读取规则，不透传运行句柄。
  return readFaultPlanData(value);
}
import { readFaultPlanData } from "../domain/fault-plan";
import {
  COMPONENT,
  aliveLifeVersion,
  aliveLifeDescriptor,
  type AliveComponent,
  type ActionRequest,
  type ToolCall,
  Role,
  Phase,
  type World,
} from "../domain";

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
  // 替换前后版本属于两份真实 Alive 组件；玩家序号相同不代表原行动许可仍然有效。
  readonly step: FaultStep;
  readonly originalVersion: number;
  readonly replacementVersion: number;
}

/** 显式离线输入驱动故障；不依据取消事实反推或触发故障执行。 */
export class NightFaultPlan {
  readonly plan: FaultPlan;
  private requestTurns = new Map<string, number>();
  private readonly consumed = new Set<string>();
  private lastDay = 0;
  private failed = false;
  constructor(
    private readonly world: World,
    input: unknown,
    allowNobleRequest = false,
  ) {
    this.plan = readFaultPlan(input);
    if (this.plan.version === "awa_noble_request_fault_plan_v1" && !allowNobleRequest)
      throw new Error("fault_plan_noble_board_required");
    for (const step of this.plan.steps)
      if (
        !world.hasEntity(step.at.afterDecision.actorId) ||
        !world.hasEntity(step.mutation.playerId)
      )
        throw new Error("fault_plan_player_unknown");
  }

  /** 调用方在本波任一来源写入 Alive 之前，提供实际已提交的选择。 */
  applyBeforeNightSourceFreeze(
    day: number,
    decision: FaultDecisionBoundary | null,
    recordApplied: (fault: AppliedFault) => void,
  ): readonly string[] {
    if (this.failed) throw new Error("fault_plan_failed");
    if (this.plan.version !== "awa_fault_plan_v1") return [];
    try {
      return this.apply(day, decision, recordApplied);
    } catch (error) {
      // 任一应用失败后本计划永久终止，防止恢复旧字段或重新调用带来第二次故障。
      this.failed = true;
      throw error;
    }
  }

  private apply(
    day: number,
    decision: FaultDecisionBoundary | null,
    recordApplied: (fault: AppliedFault) => void,
  ): readonly string[] {
    if (this.plan.version !== "awa_fault_plan_v1") return [];
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
    // 先替换生命组件并消费计划，再调用必需的同步记录器；记录失败不回滚已提交的替换。
    this.world.addComponent(step.mutation.playerId, COMPONENT.Alive, replacement);
    this.consumed.add(step.id);
    this.lastDay = day;
    const result: unknown = recordApplied({
      step,
      originalVersion,
      replacementVersion: aliveLifeVersion(replacement)!,
    });
    if (result !== undefined) {
      // 仅对已验证的原生 Promise 附加拒绝处理，避免吞掉记录器协议错误或执行任意 thenable。
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

  /**
   * 显式贵族故障只在真实 Provider 正常返回后、原领域资格复验前执行。
   * 候选仍是候选，不伪造 paid/错误；替换本身先提交，必需因果记录失败不回滚，失败计划不再重试。
   * 无此计划时 PhaseManager 不安装此代理；旧猎魔冻结端口也不消费这些请求步骤。
   */
  applyAfterProviderReturn(
    request: ActionRequest,
    action: ToolCall | null,
    recordApplied: (fault: {
      step: NobleRequestFaultStep;
      originalVersion: number;
      replacementVersion: number;
    }) => void,
  ): void {
    if (this.failed) throw new Error("fault_plan_failed");
    if (this.plan.version !== "awa_noble_request_fault_plan_v1") return;
    const step = this.plan.steps[0],
      after = step.at.afterDecision;
    if (
      request.actorId !== after.actorId ||
      request.context.day !== step.at.day ||
      request.context.stage !== after.stage
    )
      return;
    const key = `${request.actorId}/${request.context.day}/${request.context.stage}`,
      turn = (this.requestTurns.get(key) ?? 0) + 1;
    this.requestTurns.set(key, turn);
    try {
      if (this.consumed.has(step.id) || turn !== after.turn)
        throw new Error("fault_plan_boundary_repeated");
      if (
        typeof recordApplied !== "function" ||
        types.isProxy(recordApplied) ||
        types.isAsyncFunction(recordApplied) ||
        types.isGeneratorFunction(recordApplied)
      )
        throw new Error("fault_plan_recorder_invalid");
      const actorRole = this.world.getComponent(request.actorId, COMPONENT.Role)?.role,
        reveal = after.stage === "awakened_idiot_reveal_speech",
        tool = reveal
          ? "speak"
          : after.stage === "secret_body"
            ? "protect_secret_body"
            : "choose_servant";
      if (
        request.phase !== (reveal ? Phase.Voting : Phase.Night) ||
        actorRole !== (after.stage === "night_noble" ? Role.NightNoble : Role.AwakenedIdiot) ||
        !action ||
        action.name !== tool ||
        !(
          step.mutation.playerId === request.actorId ||
          (!reveal &&
            (action.args as { target_id: number | null }).target_id === step.mutation.playerId)
        )
      )
        throw new Error("fault_plan_decision_boundary_invalid");
      const original = this.world.getComponent(step.mutation.playerId, COMPONENT.Alive),
        version = original && aliveLifeVersion(original),
        factory = original && aliveLifeDescriptor(original),
        actual = original && Object.getOwnPropertyDescriptor(original, "alive");
      if (
        !original ||
        types.isProxy(original) ||
        version === undefined ||
        !factory ||
        !actual ||
        actual.get !== factory.get ||
        actual.set !== factory.set ||
        actual.enumerable !== factory.enumerable ||
        actual.configurable !== factory.configurable ||
        original.alive !== true
      )
        throw new Error("fault_plan_original_life_invalid");
      const replacement = createAliveComponent(true, this.world.locale);
      this.world.addComponent(step.mutation.playerId, COMPONENT.Alive, replacement);
      this.consumed.add(step.id);
      // 使用与原 v1 相同的同步记录器规则；不能吞异步结果或执行任意 thenable。
      const result: unknown = recordApplied({
        step,
        originalVersion: version,
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
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }

  assertConsumed(): void {
    if (this.failed) throw new Error("fault_plan_failed");
    if (this.consumed.size !== this.plan.steps.length) throw new Error("fault_plan_unconsumed");
  }
}
