/**
 * 提供 World 组件图和领域公共 API 消费的具名匿名留言类型入口。
 * 输入为 GC 唯一公共数据声明；输出保持 WallNoteComponent 类型名与原四字段，不复制形状。
 * 组件图／墙机制已有真实消费者，故保留此 canonical type re-export；不创建库存、读取
 * World 或持有授权／生命句柄，玩家观察直接消费 GC，数据不等于写信许可。
 */
export type { WallNoteComponent } from "@ai-werewolf-arena/game-contract/facts/wall-notes";
