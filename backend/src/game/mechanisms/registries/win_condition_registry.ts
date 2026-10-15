/**
 * 负责胜利条件规格索引和具名评估委托。输入为原规格、World、条件与检查点，输出原判定或 null，未知条件保原错误。
 * 索引唯一持有规格 Map，允许检查点才调用原 evaluate；本注册表不推进阶段或封盘。
 */
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-contract";
/** 文件说明：管理胜利条件规格与评估入口。 */
import { WinDecision, WinCondition } from "../../../domain/model";
import { World } from "../../../domain/world";
import { DEFAULT_WIN_CONDITION_SPECS } from "../win_conditions/default_specs";
import { WinConditionSpec } from "../win_conditions/contracts";

/** 胜利条件注册表。 */
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

  evaluate(
    world: World,
    condition: WinCondition,
    checkpoint?: VictoryCheckpoint,
  ): WinDecision | null {
    const spec = this.specById.get(condition);
    if (!spec) {
      throw new Error(`Unknown win condition: ${condition}`);
    }
    if (spec.checkpoints && (checkpoint === undefined || !spec.checkpoints.includes(checkpoint)))
      return null;
    return spec.evaluate(world, checkpoint);
  }

  all(): WinConditionSpec[] {
    return Array.from(this.specById.values());
  }
}

let defaultRegistry: WinConditionRegistry | null = null;

/** 获取默认胜利条件注册表实例。 */
export function getDefaultWinConditionRegistry(): WinConditionRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new WinConditionRegistry();
  }
  return defaultRegistry;
}
