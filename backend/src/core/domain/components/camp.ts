/**
 * 负责定义阵营数据结构并创建原可写组件。输入是原阵营枚举，输出保留原 camp 引用与字段；
 * 知识、狼聊、刀权与胜利归属仍有各自所有者，领域不根据阵营生成文案或权限。
 */
import { Camp } from "@ai-werewolf-arena/game-contract";

/**
 * 阵营组件：记录玩家阵营信息。
 */
export interface CampComponent {
  camp: Camp;
}

/**
 * 创建阵营组件。
 */
export function createCampComponent(camp: Camp): CampComponent {
  return {
    camp,

  };
}
