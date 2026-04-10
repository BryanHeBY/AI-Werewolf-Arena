import { GameResult, WinCondition } from "../../domain/model";
import { World } from "../../domain/world";
import {
  DEFAULT_WIN_CONDITION_SPECS,
} from "../win_conditions/default_specs";
import { WinConditionSpec } from "../win_conditions/contracts";

export class WinConditionRegistry {
  private readonly specById = new Map<WinCondition, WinConditionSpec>();

  constructor(specs: WinConditionSpec[] = DEFAULT_WIN_CONDITION_SPECS) {
    for (const spec of specs) {
      this.specById.set(spec.id, spec);
    }
  }

  get(condition: WinCondition): WinConditionSpec | undefined {
    return this.specById.get(condition);
  }

  evaluate(world: World, condition: WinCondition): GameResult | null {
    const spec = this.specById.get(condition);
    if (!spec) {
      throw new Error(`Unknown win condition: ${condition}`);
    }
    return spec.evaluate(world);
  }

  all(): WinConditionSpec[] {
    return Array.from(this.specById.values());
  }
}

let defaultRegistry: WinConditionRegistry | null = null;

export function getDefaultWinConditionRegistry(): WinConditionRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new WinConditionRegistry();
  }
  return defaultRegistry;
}
