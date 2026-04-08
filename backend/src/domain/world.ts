import { EntityId, Role } from "./model";
import { COMPONENT, ComponentName } from "./components/names";
import { AliveComponent } from "./components/alive";
import { RoleComponent } from "./components/role";

export class World {
  private nextId: EntityId = 1;
  private entities: Set<EntityId> = new Set();
  private stores: Map<ComponentName, Map<EntityId, unknown>> = new Map();

  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  entityIds(): EntityId[] {
    return [...this.entities].sort((a, b) => a - b);
  }

  addComponent<T>(entityId: EntityId, name: ComponentName, component: T): void {
    if (!this.hasEntity(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    const store = this.ensureStore(name);
    store.set(entityId, component);
  }

  getComponent<T>(entityId: EntityId, name: ComponentName): T | undefined {
    const store = this.stores.get(name);
    return store?.get(entityId) as T | undefined;
  }

  removeComponent(entityId: EntityId, name: ComponentName): void {
    const store = this.stores.get(name);
    store?.delete(entityId);
  }

  entitiesWith(...names: ComponentName[]): EntityId[] {
    return this.entityIds().filter((entityId) => {
      return names.every((name) => {
        const store = this.stores.get(name);
        return store?.has(entityId) ?? false;
      });
    });
  }

  getAliveEntityIds(): EntityId[] {
    return this.entitiesWith(COMPONENT.Alive).filter((id) => {
      const alive = this.getComponent<AliveComponent>(id, COMPONENT.Alive);
      return alive?.alive === true;
    });
  }

  getEntityIdsByRole(role: Role): EntityId[] {
    return this.entitiesWith(COMPONENT.Role).filter((id) => {
      const roleComp = this.getComponent<RoleComponent>(id, COMPONENT.Role);
      return roleComp?.role === role;
    });
  }

  private ensureStore(name: ComponentName): Map<EntityId, unknown> {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map<EntityId, unknown>();
      this.stores.set(name, store);
    }
    return store;
  }
}
