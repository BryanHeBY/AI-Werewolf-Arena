import { Phase } from "../model";

// 阶段顺序注册表，支持按板子动态替换默认 phase 顺序。
export class PhaseRegistry {
  private order: Phase[];

  constructor(order: Phase[] = [Phase.Night, Phase.Day, Phase.Voting]) {
    this.order = [...order];
  }

  getOrder(): Phase[] {
    return [...this.order];
  }

  registerOrder(order: Phase[]): void {
    this.order = [...order];
  }
}
