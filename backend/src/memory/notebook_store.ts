import { EntityId } from "../domain/model";

/**
 * 私密笔记本存储：
 * 每个玩家一份，优先级高于普通上下文，不参与自动裁剪。
 */
export class NotebookStore {
  private readonly data: Map<EntityId, string[]> = new Map();

  append(entityId: EntityId, note: string): void {
    const list = this.data.get(entityId) ?? [];
    list.push(note);
    this.data.set(entityId, list);
  }

  get(entityId: EntityId): string[] {
    return [...(this.data.get(entityId) ?? [])];
  }
}
