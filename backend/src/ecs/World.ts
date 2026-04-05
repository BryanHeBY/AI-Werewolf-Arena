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

  addComponent<T extends Component>(
    entityId: EntityId,
    component: T,
    componentType?: string,
  ): void {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    const type = componentType || component.constructor.name;
    const entityComponents = this.components.get(entityId) || new Map();
    entityComponents.set(type, component);
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

  /**
   * ECS 查询方法：根据组件类型查询所有匹配的实体及其组件数据
   * 返回格式示例: [{ entityId: 1, identity: IdentityComponent, status: StatusComponent }]
   */
  query<T extends Record<string, any>>(
    ...componentNames: string[]
  ): Array<{ entityId: EntityId } & T> {
    const results: Array<{ entityId: EntityId } & T> = [];

    // 遍历所有实体
    for (const [entityId, components] of this.components) {
      // 检查实体是否包含所有请求的组件
      const hasAllComponents = componentNames.every((componentName) =>
        components.has(componentName),
      );

      if (hasAllComponents) {
        // 创建结果对象
        const result: any = { entityId };

        // 添加所有请求的组件数据
        for (const componentName of componentNames) {
          const component = components.get(componentName);
          if (component) {
            // 使用组件类名作为键（例如 "IdentityComponent"）
            result[componentName] = component;
          }
        }

        results.push(result as { entityId: EntityId } & T);
      }
    }

    return results;
  }

  /**
   * 根据实体ID获取所有组件
   */
  getAllComponents(entityId: EntityId): Map<string, Component> | null {
    return this.components.get(entityId) || null;
  }

  /**
   * 检查实体是否拥有特定组件
   */
  hasComponent(entityId: EntityId, componentName: string): boolean {
    const components = this.components.get(entityId);
    return components ? components.has(componentName) : false;
  }
}
