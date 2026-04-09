import { EntityId } from "../domain/model";

/**
 * 存放“滚动摘要”文本：
 * 由外部策略决定何时压缩与更新，这里只负责按玩家读写。
 */
export class RollingSummaryStore {
  private readonly data: Map<EntityId, string> = new Map();

  /**
   * 覆盖设置玩家滚动摘要。
   */
  set(entityId: EntityId, summary: string): void {
    this.data.set(entityId, summary);
  }

  /**
   * 读取玩家滚动摘要。
   */
  get(entityId: EntityId): string {
    return this.data.get(entityId) ?? "";
  }

  /**
   * 追加摘要片段。
   */
  append(entityId: EntityId, delta: string): void {
    const current = this.get(entityId);
    const next = current ? `${current}\n${delta}` : delta;
    this.data.set(entityId, next);
  }
}
