/**
 * Owns entity IDs, component Maps and transient original-life death permissions.
 * Inputs are existing entity/slot operations and lifecycle callbacks; outputs
 * are the original mutable component references, selections and permission IDs.
 * Only this World writes its stores; factories and role owners retain their
 * value/state checks. Typed default calls add no runtime guard, copy or freeze.
 * Explicit legacy generics temporarily retain unchecked typing until C44 removes
 * that escape; stale life/currentness still revokes death permissions as before.
 */
import { EntityId, Phase, Role } from "./model";
import { COMPONENT, ComponentName } from "./components/names";
import type { ComponentMap, ComponentWrite } from "./component-map";
import { AliveComponent, aliveLifeVersion } from "./components/alive";
import { RoleComponent } from "./components/role";
import { isLocale, type Locale } from "@ai-werewolf-arena/game-catalog";

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

  /** Engine-owned, transient permission; its ID alone does not grant an action. */
  openDeathAction(
    actorId: EntityId,
    tool: "shoot" | "speak" | "choose_badge_successor",
    phase: Phase,
    day: number,
    isCurrent: () => boolean = () => true,
    abilityId?: string,
  ): { readonly id: number; close(): void } {
    if (this.currentDeathAction(actorId)) throw new Error("death_action_already_open");
    const alive = this.getComponent<AliveComponent>(actorId, COMPONENT.Alive);
    const lifeVersion = alive && aliveLifeVersion(alive);
    if (
      !alive ||
      alive.alive !== false ||
      lifeVersion === undefined ||
      !this.getComponent<RoleComponent>(actorId, COMPONENT.Role) ||
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
      this.getComponent<AliveComponent>(actorId, COMPONENT.Alive) !== permit.alive ||
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
  ): void;
  /** @deprecated C44: explicit legacy type arguments bypass the slot relation. */
  addComponent<T = never>(
    entityId: EntityId,
    name: ComponentName,
    component: NoInfer<T>,
  ): void;
  addComponent<T>(entityId: EntityId, name: ComponentName, component: T): void {
    if (!this.hasEntity(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    // 每类组件一张表，按 entityId 索引。
    const store = this.ensureStore(name);
    store.set(entityId, component);
  }

  getComponent<K extends ComponentName>(
    entityId: EntityId,
    name: K,
  ): ComponentMap[K] | undefined;
  /** @deprecated C44: explicit legacy type arguments bypass the slot relation. */
  getComponent<T = never>(entityId: EntityId, name: ComponentName): NoInfer<T> | undefined;
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
