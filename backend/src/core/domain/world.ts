import { EntityId, Role } from "./model";
import { COMPONENT, ComponentName } from "./components/names";
import { AliveComponent } from "./components/alive";
import { RoleComponent } from "./components/role";

/**
 * World 是 ECS 内存状态容器。
 * 设计目标：保持结构简单、读写明确，所有系统都基于该容器进行组件查询与变更。
 */
export class World {
  private nextId: EntityId = 1;
  private entities: Set<EntityId> = new Set();
  private stores: Map<ComponentName, Map<EntityId, unknown>> = new Map();

  /**
   * 创建新实体并返回实体 ID。
   */
  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  /**
   * 判断实体是否存在。
   */
  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  /**
   * 返回当前所有实体 ID（升序）。
   */
  entityIds(): EntityId[] {
    return [...this.entities].sort((a, b) => a - b);
  }

  addComponent<T>(entityId: EntityId, name: ComponentName, component: T): void {
    if (!this.hasEntity(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    // 每类组件一张表，按 entityId 索引。
    const store = this.ensureStore(name);
    store.set(entityId, component);
  }

  getComponent<T>(entityId: EntityId, name: ComponentName): T | undefined {
    const store = this.stores.get(name);
    return store?.get(entityId) as T | undefined;
  }

  /**
   * 从实体上移除指定组件。
   */
  removeComponent(entityId: EntityId, name: ComponentName): void {
    const store = this.stores.get(name);
    store?.delete(entityId);
  }

  /**
   * 返回同时拥有给定组件集合的实体列表。
   */
  entitiesWith(...names: ComponentName[]): EntityId[] {
    // 只有同时拥有所有组件的实体才会被返回，用于系统筛选。
    return this.entityIds().filter((entityId) => {
      return names.every((name) => {
        const store = this.stores.get(name);
        return store?.has(entityId) ?? false;
      });
    });
  }

  /**
   * 返回当前存活实体 ID 列表。
   */
  getAliveEntityIds(): EntityId[] {
    return this.entitiesWith(COMPONENT.Alive).filter((id) => {
      const alive = this.getComponent<AliveComponent>(id, COMPONENT.Alive);
      return alive?.alive === true;
    });
  }

  /**
   * 按角色筛选实体 ID。
   */
  getEntityIdsByRole(role: Role): EntityId[] {
    return this.entitiesWith(COMPONENT.Role).filter((id) => {
      const roleComp = this.getComponent<RoleComponent>(id, COMPONENT.Role);
      return roleComp?.role === role;
    });
  }

  /**
   * 确保组件存储存在，不存在则懒加载创建。
   */
  private ensureStore(name: ComponentName): Map<EntityId, unknown> {
    let store = this.stores.get(name);
    if (!store) {
      // 延迟初始化组件存储，避免为未使用组件提前分配空间。
      store = new Map<EntityId, unknown>();
      this.stores.set(name, store);
    }
    return store;
  }
}
