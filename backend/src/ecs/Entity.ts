import { Entity, EntityId } from "../core/types";

/**
 * 实体管理工具
 * 提供实体创建和管理的实用函数
 */

let nextEntityId: EntityId = 1;

/**
 * 生成新的实体ID
 */
export function generateEntityId(): EntityId {
  return nextEntityId++;
}

/**
 * 创建实体对象
 */
export function createEntity(id: EntityId): Entity {
  return { id };
}

/**
 * 实体管理器
 * 批量管理实体生命周期
 */
export class EntityManager {
  private activeEntities: Set<EntityId> = new Set();
  private recycledIds: EntityId[] = [];

  /**
   * 创建新实体
   */
  create(): EntityId {
    let id: EntityId;

    if (this.recycledIds.length > 0) {
      id = this.recycledIds.pop()!;
    } else {
      id = generateEntityId();
    }

    this.activeEntities.add(id);
    return id;
  }

  /**
   * 销毁实体
   */
  destroy(entityId: EntityId): void {
    if (this.activeEntities.has(entityId)) {
      this.activeEntities.delete(entityId);
      this.recycledIds.push(entityId);
    }
  }

  /**
   * 检查实体是否存在
   */
  exists(entityId: EntityId): boolean {
    return this.activeEntities.has(entityId);
  }

  /**
   * 获取所有活动实体
   */
  getAll(): Entity[] {
    return Array.from(this.activeEntities).map((id) => ({ id }));
  }

  /**
   * 获取活动实体数量
   */
  count(): number {
    return this.activeEntities.size;
  }

  /**
   * 清空所有实体
   */
  clear(): void {
    this.activeEntities.clear();
    this.recycledIds = [];
  }
}
