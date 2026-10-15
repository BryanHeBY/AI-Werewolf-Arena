/**
 * 负责终局候选的配置选择、咒狐结果改写接线与婚约封盘前检查。
 * 输入为原配置／世界的晚读查询及已判候选；输出为原条件数组、原或改写的候选及经原领域校验的数据。
 * 婚约只接受三阵营规则；其它板子依次沿用多条件原引用、旧单条件与屠城默认，不缓存或规范化配置。
 * 本入口只选择条件；评估时点、具体到期组合和阶段检查点由实际规则组合／经理负责；咒狐只在原已完成死亡波的位置改写阵营候选。
 * 封盘前先验证婚约分配，再验证结构／成员，日期最后读取；失败不写终态、不发布事件或恢复已付资源。
 */
import {
  WinCondition,
  type ReadonlyBoardConfig,
  type Phase,
  type VictoryCheckpoint,
  type WinDecision,
} from "@ai-werewolf-arena/game-contract";
import type { World } from "../domain/world";
import { weddingSetup, weddingAssignment } from "../features/ghost-bride/ports";
import { replaceWithFoxVictory } from "../features/cursed-fox/victory-ports";
import { validateVictoryDecision } from "../engine/victory/validated-victory";

/** 查询只捕获调用方；每个原读取位置才取配置／世界，不持有第二份执行配置或生命状态。 */
export interface TerminalVictoryRuntime {
  world(): World;
  config(): ReadonlyBoardConfig;
}

function resolveConfiguredVictoryConditions(
  runtime: TerminalVictoryRuntime,
): readonly WinCondition[] {
  if (weddingSetup(runtime.world())) {
    const conditions =
      runtime.config().winConditions ??
      (runtime.config().winCondition ? [runtime.config().winCondition!] : []);
    if (conditions.length !== 1 || conditions[0] !== WinCondition.ThreeFactionsElimination)
      throw new Error("ghost_bride_win_condition_invalid");
    return [WinCondition.ThreeFactionsElimination];
  }
  if (Array.isArray(runtime.config().winConditions) && runtime.config().winConditions!.length > 0) {
    return runtime.config().winConditions!;
  }
  if (runtime.config().winCondition) {
    return [runtime.config().winCondition!];
  }
  // 不把空多条件数组当成终局不可判：保留原旧字段和最后屠城兜底。
  return [WinCondition.SlaughterCity];
}

function validateTerminalCandidate(
  decision: WinDecision,
  checkpoint: VictoryCheckpoint,
  phase: Phase,
  world: () => World,
  day: () => number,
) {
  if (weddingSetup(world())) weddingAssignment(world());
  // 婚约拒绝先于结果结构／成员，原校验器只在最后取 day；此处尚未封盘或付款。
  return validateVictoryDecision(decision, checkpoint, phase, world, day);
}

/** 三个实际候选能力；狐狸直接保原函数绑定，不叠加转发或新的胜利条件 registry。 */
export const TERMINAL_VICTORY_POLICY = Object.freeze({
  conditions: resolveConfiguredVictoryConditions,
  replaceFactionResult: replaceWithFoxVictory,
  validateCandidate: validateTerminalCandidate,
});
