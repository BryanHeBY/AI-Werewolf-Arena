/**
 * 负责保留胜负系统的既有两参数委托入口；输入原 World 与条件，输出注入评估器的原判定或 null。
 * 规则实现及允许检查点由原评估器拥有，阶段执行和最终封盘仍归管理器；这里不标死或改写结果。
 * 实例只保存原评估器引用，方法读取／调用失败原样传播，不增加缓存、回退规则或配置校验。
 */
import { WinDecision, WinCondition } from "../model";
import { World } from "../world";
import { WinConditionEvaluator } from "../registries/condition_registry";

/**
 * 既有兼容类保留当前公开入口；具体胜负算法已委托原注入评估器，不复制第二份规则。
 */
export class WinConditionSystem {
  private readonly registry: WinConditionEvaluator;

  constructor(registry: WinConditionEvaluator) {
    this.registry = registry;
  }

  /** 保原评估器方法 receiver 和两实参，不额外传检查点；返回与抛错直接交给调用方。 */
  evaluate(world: World, condition: WinCondition): WinDecision | null {
    return this.registry.evaluate(world, condition);
  }
}
