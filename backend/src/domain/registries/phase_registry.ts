import { Phase } from "../model";

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
