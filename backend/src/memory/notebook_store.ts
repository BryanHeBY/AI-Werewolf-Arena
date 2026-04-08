import { EntityId } from "../domain/model";

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
