import { Component, EntityId } from "../core/types";

/**
 * 组件基类
 * 所有组件的抽象基类
 */
export abstract class BaseComponent implements Component {
  entityId: EntityId;

  constructor(entityId: EntityId) {
    this.entityId = entityId;
  }
}

/**
 * 组件类型注册表
 * 管理组件类型和元数据
 */
export class ComponentRegistry {
  private componentTypes: Map<string, ComponentMetadata> = new Map();
  private nextTypeId: number = 1;

  /**
   * 注册组件类型
   */
  register<T extends Component>(
    componentClass: new (entityId: EntityId) => T,
    metadata: Partial<ComponentMetadata> = {},
  ): string {
    const typeName = componentClass.name;

    if (this.componentTypes.has(typeName)) {
      return typeName;
    }

    const typeId = this.nextTypeId++;
    this.componentTypes.set(typeName, {
      typeId,
      typeName,
      componentClass,
      ...metadata,
    });

    return typeName;
  }

  /**
   * 获取组件类型元数据
   */
  getMetadata(typeName: string): ComponentMetadata | null {
    return this.componentTypes.get(typeName) || null;
  }

  /**
   * 获取所有注册的组件类型
   */
  getAllTypes(): string[] {
    return Array.from(this.componentTypes.keys());
  }

  /**
   * 创建组件实例
   */
  createInstance<T extends Component>(
    typeName: string,
    entityId: EntityId,
  ): T | null {
    const metadata = this.componentTypes.get(typeName);
    if (!metadata) return null;

    return new metadata.componentClass(entityId) as T;
  }

  /**
   * 检查组件类型是否已注册
   */
  isRegistered(typeName: string): boolean {
    return this.componentTypes.has(typeName);
  }
}

/**
 * 组件元数据接口
 */
export interface ComponentMetadata {
  typeId: number;
  typeName: string;
  componentClass: new (entityId: EntityId) => any;
  description?: string;
  tags?: string[];
}

/**
 * 组件工具函数
 */

/**
 * 获取组件类型名称
 */
export function getComponentType(component: Component): string {
  return component.constructor.name;
}

/**
 * 创建组件实例的快捷函数
 */
export function createComponent<T extends Component>(
  componentClass: new (entityId: EntityId) => T,
  entityId: EntityId,
): T {
  return new componentClass(entityId);
}

/**
 * 组件查询器
 * 用于构建复杂的组件查询
 */
export class ComponentQuery {
  private requiredTypes: string[] = [];
  private excludedTypes: string[] = [];

  /**
   * 要求实体必须包含指定类型的组件
   */
  with(typeName: string): this {
    this.requiredTypes.push(typeName);
    return this;
  }

  /**
   * 要求实体不能包含指定类型的组件
   */
  without(typeName: string): this {
    this.excludedTypes.push(typeName);
    return this;
  }

  /**
   * 执行查询（需要World实例）
   */
  execute(world: any): EntityId[] {
    // 这里需要World的实现来执行查询
    // 由于World在另一个文件中，这里只提供接口
    return [];
  }

  /**
   * 获取查询描述
   */
  toString(): string {
    const requirements = this.requiredTypes.join(", ");
    const exclusions = this.excludedTypes.join(", ");

    let description = "";
    if (requirements) {
      description += `With: ${requirements}`;
    }
    if (exclusions) {
      description += ` | Without: ${exclusions}`;
    }

    return description || "Empty query";
  }
}
