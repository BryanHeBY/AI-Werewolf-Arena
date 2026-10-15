/**
 * 负责实体 ID、组件 Map 与原生命绑定的临时死亡行动许可。输入为既有实体／槽操作及
 * 生命周期回调，输出保持原可写组件引用、筛选结果和许可 ID。World 唯一写入自己的存储，
 * 工厂与角色所有者仍负责值和资源校验；槽推断不增加运行守卫、复制或冻结。
 * 旧任意组件类型 T 重载已退出，读写关系由具名槽约束；死亡许可仍按原生命版本与当前性撤销，ID 本身不授权。
 */
import { EntityId, Phase, Role } from "./model";
import { COMPONENT, ComponentName } from "./components/names";
import type { ComponentMap, ComponentWrite } from "./component-map";
import { AliveComponent, aliveLifeVersion } from "./components/alive";
import { RoleComponent } from "./components/role";
import { isLocale, type Locale } from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";

const mapGetAtCommit = Map.prototype.get,
  applyAtCommit = Reflect.apply;

/**
 * 只读实际 ECS 槽，供已拥有付款权的机制在首写前同步复核原体。它本身不授予任何写入或行动权限。
 * 拒绝 Proxy／stores 访问器，不调用可重入的 getComponent，也不复制、替换或暴露存储 Map。
 */
export function readWorldComponentAtCommit<K extends ComponentName>(
  world: World,
  entityId: EntityId,
  name: K,
): ComponentMap[K] | undefined {
  if (types.isProxy(world)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(world, "stores");
  if (!descriptor || !("value" in descriptor) || types.isProxy(descriptor.value)) return undefined;
  try {
    const store = applyAtCommit(mapGetAtCommit, descriptor.value, [name]);
    if (!store || types.isProxy(store)) return undefined;
    return applyAtCommit(mapGetAtCommit, store, [entityId]) as ComponentMap[K] | undefined;
  } catch {
    // Map 原型方法只接受真实内部槽；同形对象／访问器不作为 World 查询来源。
    return undefined;
  }
}

/**
 * World 是 ECS 内存状态容器。
 * 设计目标：保持结构简单、读写明确，所有系统都基于该容器进行组件查询与变更。
 */
export class World {
  constructor(readonly locale: Locale = "zh-CN") {
    if (!isLocale(locale)) throw new Error("game_locale_invalid");
  }
  private nextId: EntityId = 1;
  private entities: Set<EntityId> = new Set();
  private stores: Map<ComponentName, Map<EntityId, unknown>> = new Map();
  private nextDeathActionId = 1;
  // 许可绑定原 Alive 对象和该对象的生命版本；复活、替换组件或失去当前性均撤销旧许可。
  private deathActions = new Map<
    EntityId,
    {
      id: number;
      tool: "shoot" | "speak" | "choose_badge_successor";
      phase: Phase;
      day: number;
      abilityId?: string;
      alive: AliveComponent;
      lifeVersion: number;
      isCurrent: () => boolean;
    }
  >();

  /** 引擎拥有的临时行动许可；ID 不授予行动。World 复核原生命与传入的当前性回调，带阶段的查询另核许可记录的 phase／day。 */
  openDeathAction(
    actorId: EntityId,
    tool: "shoot" | "speak" | "choose_badge_successor",
    phase: Phase,
    day: number,
    isCurrent: () => boolean = () => true,
    abilityId?: string,
  ): { readonly id: number; close(): void } {
    if (this.currentDeathAction(actorId)) throw new Error("death_action_already_open");
    const alive = this.getComponent(actorId, COMPONENT.Alive);
    const lifeVersion = alive && aliveLifeVersion(alive);
    if (
      !alive ||
      alive.alive !== false ||
      lifeVersion === undefined ||
      !this.getComponent(actorId, COMPONENT.Role) ||
      !Number.isSafeInteger(day) ||
      day < 1 ||
      !["shoot", "speak", "choose_badge_successor"].includes(tool) ||
      !Object.values(Phase).includes(phase) ||
      phase === Phase.GameOver ||
      (abilityId !== undefined &&
        (tool !== "shoot" ||
          typeof abilityId !== "string" ||
          !/^[a-z][a-z0-9:_-]{0,127}$/.test(abilityId) ||
          abilityId.startsWith("native:")))
    ) {
      throw new Error("death_action_invalid_actor_or_stage");
    }
    const id = this.nextDeathActionId++;
    this.deathActions.set(actorId, {
      id,
      tool,
      phase,
      day,
      abilityId,
      alive,
      lifeVersion,
      isCurrent,
    });
    return Object.freeze({
      id,
      close: () => {
        if (this.deathActions.get(actorId)?.id === id) this.deathActions.delete(actorId);
      },
    });
  }

  hasDeathAction(
    actorId: EntityId,
    tool: string,
    phase: Phase,
    day: number | undefined,
    id: number | undefined,
    abilityId?: string,
  ): boolean {
    const permit = this.currentDeathAction(actorId);
    return (
      permit !== undefined &&
      permit.id === id &&
      permit.tool === tool &&
      permit.phase === phase &&
      permit.day === day &&
      permit.abilityId === abilityId
    );
  }

  isDeathActionOpen(actorId: EntityId, tool: string, id: number, abilityId?: string): boolean {
    const permit = this.currentDeathAction(actorId);
    return (
      permit !== undefined &&
      permit.id === id &&
      permit.tool === tool &&
      permit.abilityId === abilityId
    );
  }

  private currentDeathAction(actorId: EntityId) {
    const permit = this.deathActions.get(actorId);
    if (!permit) return undefined;
    if (
      this.getComponent(actorId, COMPONENT.Alive) !== permit.alive ||
      permit.alive.alive !== false ||
      aliveLifeVersion(permit.alive) !== permit.lifeVersion ||
      !permit.isCurrent()
    ) {
      this.deathActions.delete(actorId);
      return undefined;
    }
    return permit;
  }

  get activeDeathActionCount(): number {
    for (const actorId of this.deathActions.keys()) this.currentDeathAction(actorId);
    return this.deathActions.size;
  }

  closeDeathActions(): void {
    this.deathActions.clear();
  }

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

  addComponent<K extends ComponentName, C extends ComponentWrite<NoInfer<K>>>(
    entityId: EntityId,
    name: K,
    component: C,
  ): void {
    if (!this.hasEntity(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    // 每类组件一张表，按 entityId 索引。
    const store = this.ensureStore(name);
    store.set(entityId, component);
  }

  getComponent<K extends ComponentName>(entityId: EntityId, name: K): ComponentMap[K] | undefined {
    const store = this.stores.get(name);
    return store?.get(entityId) as ComponentMap[K] | undefined;
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
      const alive = this.getComponent(id, COMPONENT.Alive);
      return alive?.alive === true;
    });
  }

  /**
   * 按角色筛选实体 ID。
   */
  getEntityIdsByRole(role: Role): EntityId[] {
    return this.entitiesWith(COMPONENT.Role).filter((id) => {
      const roleComp = this.getComponent(id, COMPONENT.Role);
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
