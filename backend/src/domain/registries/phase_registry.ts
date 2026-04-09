import { Phase } from "../model";

/**
 * 阶段顺序注册表：支持按板子动态替换默认 phase 顺序。
 */
export class PhaseRegistry {
  private order: Phase[];

  constructor(order: Phase[] = [Phase.Night, Phase.Day, Phase.Voting]) {
    this.order = [...order];
  }

  /**
   * 获取当前阶段顺序配置。
   */
  getOrder(): Phase[] {
    return [...this.order];
  }

  /**
   * 注册新的阶段顺序配置。
   */
  registerOrder(order: Phase[]): void {
    this.order = [...order];
  }
}
