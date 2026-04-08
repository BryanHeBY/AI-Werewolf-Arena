import { EntityId } from "../domain/model";

/**
 * 存放“滚动摘要”文本：
 * 由外部策略决定何时压缩与更新，这里只负责按玩家读写。
 */
export class RollingSummaryStore {
  private readonly data: Map<EntityId, string> = new Map();

  set(entityId: EntityId, summary: string): void {
    this.data.set(entityId, summary);
  }

  get(entityId: EntityId): string {
    return this.data.get(entityId) ?? "";
  }

  append(entityId: EntityId, delta: string): void {
    const current = this.get(entityId);
    const next = current ? `${current}\n${delta}` : delta;
    this.data.set(entityId, next);
  }
}
