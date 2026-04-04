import {
  World as WorldInterface,
  Entity,
  EntityId,
  Component,
  System,
  GamePhase,
} from "../core/types";

export class GameWorld implements WorldInterface {
  private entities: Map<EntityId, Entity> = new Map();
  private components: Map<EntityId, Map<string, Component>> = new Map();
  private systems: System[] = [];
  private nextEntityId: EntityId = 1;

  createEntity(): EntityId {
    const entityId = this.nextEntityId++;
    this.entities.set(entityId, { id: entityId });
    this.components.set(entityId, new Map());
    return entityId;
  }

  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    const componentType = component.constructor.name;
    const entityComponents = this.components.get(entityId) || new Map();
    entityComponents.set(componentType, component);
    this.components.set(entityId, entityComponents);
  }

  removeComponent(entityId: EntityId, componentType: string): void {
    const entityComponents = this.components.get(entityId);
    if (entityComponents) {
      entityComponents.delete(componentType);
    }
  }

  getComponent<T extends Component>(
    entityId: EntityId,
    componentType: string,
  ): T | null {
    const entityComponents = this.components.get(entityId);
    return (entityComponents?.get(componentType) as T) || null;
  }

  getEntitiesWithComponent(componentType: string): EntityId[] {
    const entities: EntityId[] = [];

    for (const [entityId, components] of this.components) {
      if (components.has(componentType)) {
        entities.push(entityId);
      }
    }

    return entities;
  }

  registerSystem(system: System): void {
    this.systems.push(system);
  }

  update(phase: GamePhase): void {
    const entities = Array.from(this.entities.values());
    for (const system of this.systems) {
      system.update(phase, entities);
    }
  }
}
