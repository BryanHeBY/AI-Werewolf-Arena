/**
 * 负责：拥有一次真实执行的规则计划及唯一 BoardParameters 引用。
 * 输入：已绑定参数、原时点采集的阶段贡献和延迟读取的夜间运行端口；
 * 输出：实际引擎使用的原 handler、原生策略、生命周期单位及脱离运行态的归档参数。
 * 默认自有数据贡献在首次晚收集时固定成员与顺序，后续变化明确拒绝隐式 revision。
 * 注入或不透明来源保留原 collector 和惰性拉取；不缓存 execute 函数、角色资格、
 * 玩家、目标、库存或 World，不新增 World 全局表或归档字段。
 */
import type { BoardParameters } from "./board-parameters";
import type { NightStageRegistry } from "./night-stage-plan";
import type { NightStagePlan, SupportedNightDefinition } from "./night-stage-plan-contracts";
import type { World } from "../core/domain/world";
import { types } from "node:util";
import { bindNativeNightFailurePolicy } from "./native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "./native-night-target-policy";
import { bindNativeNightEffects } from "./native-night-effects";
import {
  NightManagerLifecycle,
  prepareNightPipelineLifecycle,
  type NightManagerLifecycleRuntime,
  type NightPipelineLifecycleRuntime,
  type NightLifecycleHandoff,
} from "./night-lifecycle-plan";

const constructionToken = Symbol("rule-plan-construction");
const checkpoints = Object.freeze({
  nightSettled: "night_settled",
  dayInterrupted: "day_interrupted",
  exileSettled: "exile_settled",
  maxDays: "max_days_reached",
} as const);

function sameDefinition(left: SupportedNightDefinition, right: SupportedNightDefinition): boolean {
  if (left.roles.length !== right.roles.length) return false;
  return left.roles.every((row, index) => {
    const other = right.roles[index]!;
    return row.role === other.role &&
      row.handlers.length === other.handlers.length &&
      row.handlers.every((handler, ordinal) => handler === other.handlers[ordinal]) &&
      row.night.length === other.night.length &&
      row.night.every((kind, ordinal) => kind === other.night[ordinal]) &&
      row.death.length === other.death.length &&
      row.death.every((kind, ordinal) => kind === other.death[ordinal]);
  });
}

/** 组合直接复用已存在的具体策略及单位，不另建执行框架。 */
export class RulePlan {
  readonly parameters: BoardParameters;
  readonly nativeNightFailure = bindNativeNightFailurePolicy;
  readonly nativeNightTargets = bindNativeNightTargetPolicy;
  readonly nativeNightEffects = bindNativeNightEffects;
  readonly checkpoints = checkpoints;
  // 只在首次默认晚收集后固定有限贡献；actor、实例和资源始终由现场查询决定。
  #definition: SupportedNightDefinition | null = null;
  // 潜在阶段描述可保留未激活预约，实际 entries 仍使用原 collector 当夜选择。
  #metadata: NightStagePlan["metadata"] | null = null;
  // 记录已固定的标准来源身份；其转为 Proxy/访问器不能绕过 revision 检查。
  #standardRegistry: NightStageRegistry | null = null;

  private constructor(token: typeof constructionToken, parameters: BoardParameters) {
    if (token !== constructionToken) throw new Error("rule_plan_constructor_forbidden");
    this.parameters = parameters;
    Object.freeze(this);
  }

  static compile(parameters: BoardParameters): RulePlan {
    return new RulePlan(constructionToken, parameters);
  }

  /** 私有字段品牌先拒绝伪造别名；不执行调用方 getter 或 Proxy trap。 */
  static isOwned(input: unknown): input is RulePlan {
    return input !== null && typeof input === "object" && #definition in input;
  }

  createNightManagerLifecycle(runtime: NightManagerLifecycleRuntime): NightManagerLifecycle {
    return new NightManagerLifecycle(runtime);
  }

  prepareNightPipelineLifecycle(
    runtime: NightPipelineLifecycleRuntime,
    config: Parameters<typeof prepareNightPipelineLifecycle>[1],
    day: number,
    handoff?: () => NightLifecycleHandoff | undefined,
  ) {
    return prepareNightPipelineLifecycle(runtime, config, day, handoff, this.parameters);
  }

  /** 在原时点采集；不透明 iterator 不预先耗尽，下一项仍在前一 handler 提交后拉取。 */
  nightPlan(registry: NightStageRegistry, world: () => World): NightStagePlan {
    // 原调用先读取 getPlan 方法，再求值 World 参数；不能在跨 owner 时倒置 getter 前缀。
    const plan = registry.getPlan(this.parameters.board, world());
    if (plan.mode !== "snapshot") {
      if (registry === this.#standardRegistry)
        throw new Error("rule_plan_revision_not_supported");
      return plan;
    }
    if (plan.definition === null) {
      if (plan.definitionScope === "built-in" && this.#definition !== null)
        throw new Error("rule_plan_revision_not_supported");
      return plan;
    }
    if (this.#definition === null) {
      this.#definition = plan.definition;
      this.#standardRegistry = registry;
      const reserved = plan.definition.reservations.map((handler, ordinal) => {
        if (types.isProxy(handler)) return null;
        const id = Object.getOwnPropertyDescriptor(handler, "id"),
          priority = Object.getOwnPropertyDescriptor(handler, "priority");
        if (!id || !("value" in id) || typeof id.value !== "string" ||
          !priority || !("value" in priority) || typeof priority.value !== "number") return null;
        return Object.freeze({ kind: "data" as const, id: id.value, priority: priority.value, ordinal });
      });
      this.#metadata = Object.freeze([...plan.metadata, ...reserved.filter((entry) => entry !== null)]);
      return plan;
    }
    if (!sameDefinition(this.#definition, plan.definition))
      throw new Error("rule_plan_revision_not_supported");
    // 原体退役后，现场选择可以移除可选预约；固定定义只校验既有 ID/priority，
    // 不把潜在预约插入执行列表，避免多出原事件、record 或 RNG 操作。
    for (const item of plan.metadata) {
      if (item.kind !== "data") throw new Error("rule_plan_revision_not_supported");
      const previous = this.#metadata!.find((entry) => entry.kind === "data" && entry.id === item.id);
      if (!previous || previous.kind !== "data" || previous.priority !== item.priority)
        throw new Error("rule_plan_revision_not_supported");
    }
    return plan;
  }

  /** 归档只编码同一参数 owner 的脱离克隆，计划对象和 callback 不写入归档。 */
  encodeParameters() {
    return this.parameters.encode();
  }
}
Object.freeze(RulePlan.prototype);
Object.freeze(RulePlan);
