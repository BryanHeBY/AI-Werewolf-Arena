import { GamePhase, Entity } from "../core/types";
import { GameWorld } from "./World";

/**
 * 系统接口
 */
export interface SystemInterface {
  update(phase: GamePhase, entities: Entity[]): void;
}

/**
 * 系统基类
 * 所有游戏系统的抽象基类
 */
export abstract class BaseSystem implements SystemInterface {
  /**
   * 系统名称
   */
  name: string;

  /**
   * 系统依赖的其他系统（按名称）
   */
  dependencies: string[] = [];

  /**
   * 系统优先级（数字越小越先执行）
   */
  priority: number = 0;

  constructor(name?: string) {
    this.name = name || this.constructor.name;
  }

  /**
   * 更新系统逻辑
   */
  abstract update(phase: GamePhase, entities: Entity[]): void;

  /**
   * 系统初始化（可选）
   */
  initialize?(world: GameWorld): void;

  /**
   * 系统清理（可选）
   */
  cleanup?(world: GameWorld): void;
}

/**
 * 系统管理器
 * 管理所有系统的生命周期和执行顺序
 */
export class SystemManager {
  private systems: Map<string, BaseSystem> = new Map();
  private executionOrder: string[] = [];
  private initialized = false;

  /**
   * 注册系统
   */
  register(system: BaseSystem): void {
    if (this.systems.has(system.name)) {
      throw new Error(`System '${system.name}' is already registered`);
    }

    this.systems.set(system.name, system);

    // 如果已经初始化，重新计算执行顺序
    if (this.initialized) {
      this.calculateExecutionOrder();
    }
  }

  /**
   * 移除系统
   */
  remove(systemName: string): void {
    if (!this.systems.has(systemName)) {
      throw new Error(`System '${systemName}' is not registered`);
    }

    this.systems.delete(systemName);

    // 如果已经初始化，重新计算执行顺序
    if (this.initialized) {
      this.calculateExecutionOrder();
    }
  }

  /**
   * 获取系统
   */
  get(systemName: string): BaseSystem | null {
    return this.systems.get(systemName) || null;
  }

  /**
   * 初始化所有系统
   */
  initialize(world: GameWorld): void {
    if (this.initialized) {
      console.warn("SystemManager is already initialized");
      return;
    }

    // 计算执行顺序
    this.calculateExecutionOrder();

    // 按顺序初始化系统
    for (const systemName of this.executionOrder) {
      const system = this.systems.get(systemName)!;
      if (system.initialize) {
        system.initialize(world);
      }
    }

    this.initialized = true;
  }

  /**
   * 更新所有系统
   */
  update(phase: GamePhase, entities: Entity[], world: GameWorld): void {
    if (!this.initialized) {
      this.initialize(world);
    }

    // 按顺序更新系统
    for (const systemName of this.executionOrder) {
      const system = this.systems.get(systemName)!;
      system.update(phase, entities);
    }
  }

  /**
   * 清理所有系统
   */
  cleanup(world: GameWorld): void {
    if (!this.initialized) return;

    // 按执行顺序的逆序清理系统
    for (let i = this.executionOrder.length - 1; i >= 0; i--) {
      const systemName = this.executionOrder[i];
      const system = this.systems.get(systemName)!;
      if (system.cleanup) {
        system.cleanup(world);
      }
    }

    this.initialized = false;
  }

  /**
   * 计算系统执行顺序（基于依赖关系和优先级）
   */
  private calculateExecutionOrder(): void {
    const systemNames = Array.from(this.systems.keys());

    // 构建依赖图
    const graph: Map<string, Set<string>> = new Map();
    const indegree: Map<string, number> = new Map();

    // 初始化图和入度
    for (const name of systemNames) {
      graph.set(name, new Set());
      indegree.set(name, 0);
    }

    // 添加依赖边
    for (const name of systemNames) {
      const system = this.systems.get(name)!;
      for (const dep of system.dependencies) {
        if (this.systems.has(dep)) {
          const neighbors = graph.get(dep)!;
          neighbors.add(name);
          indegree.set(name, indegree.get(name)! + 1);
        }
      }
    }

    // 拓扑排序（加上优先级）
    const queue: Array<{ name: string; priority: number }> = [];

    // 初始队列（入度为0的系统）
    for (const name of systemNames) {
      if (indegree.get(name) === 0) {
        const system = this.systems.get(name)!;
        queue.push({ name, priority: system.priority });
      }
    }

    // 按优先级排序队列
    queue.sort((a, b) => a.priority - b.priority);

    const order: string[] = [];

    while (queue.length > 0) {
      const { name } = queue.shift()!;
      order.push(name);

      // 减少依赖系统的入度
      const neighbors = graph.get(name)!;
      for (const neighbor of Array.from(neighbors)) {
        const newIndegree = indegree.get(neighbor)! - 1;
        indegree.set(neighbor, newIndegree);

        if (newIndegree === 0) {
          const system = this.systems.get(neighbor)!;
          queue.push({ name: neighbor, priority: system.priority });
          queue.sort((a, b) => a.priority - b.priority);
        }
      }
    }

    this.executionOrder = order;
  }

  /**
   * 获取系统数量
   */
  count(): number {
    return this.systems.size;
  }

  /**
   * 获取所有系统名称
   */
  getAllNames(): string[] {
    return Array.from(this.systems.keys());
  }

  /**
   * 检查系统是否已注册
   */
  has(systemName: string): boolean {
    return this.systems.has(systemName);
  }
}
