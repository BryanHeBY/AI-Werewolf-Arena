/**
 * 负责玩家胜利归属组件的结构与创建。输入为明确 affiliations，输出经共享 reader 校验复制后的组件；胜利归属与实际 Camp 阵营及技能独立。
 * 运行组件仍归 World 持有，创建器不推断真实阵营、不选择胜者或授予行动许可。
 */
import type { VictoryAffiliation } from "@ai-werewolf-arena/game-contract";
import { readVictoryAffiliations } from "@ai-werewolf-arena/replay-contract";

/** 独立胜利成员归属，与实际 Camp 阵营和能力分别持有。 */
export interface VictoryComponent {
  affiliations: VictoryAffiliation[];
}
export function createVictoryComponent(
  affiliations: readonly VictoryAffiliation[],
): VictoryComponent {
  return { affiliations: readVictoryAffiliations(affiliations) };
}
