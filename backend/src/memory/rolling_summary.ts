import { EntityId } from "../domain/model";

export class RollingSummaryStore {
  private readonly data: Map<EntityId, string> = new Map();

  set(entityId: EntityId, summary: string): void {
    this.data.set(entityId, summary);
  }

  get(entityId: EntityId): string {
    return this.data.get(entityId) ?? "";
  }
}
