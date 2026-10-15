/**
 * 负责一夜摄梦关系的原生命查询、保护及追加死亡闭包。输入为原 links、已付庇护和当前性回调，
 * 输出为目标、伤害扩展及事件；同一实例唯一持有 reasons／emitted，不复制关系或重新支付效果。
 * 运行接口区分查询和更新：连续／关联推导累计原因，expand 写调用方伤害，record 写去重与 events。
 * 原组件引用、回调和接收方保持，句柄不进入玩家知识或录制；本模块不标死、授予请求或推进阶段。
 */
import type { DreamNightEffects } from "../../domain/dream-night-effects";
import { AliveComponent, aliveLifeVersion } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import { DeathCause, type EntityId, type GameEvent } from "../../domain/model";
import type { World } from "../../domain/world";
import type { DamageResolutionResult } from "../../domain/systems/damage-resolution-system";
import type { NightImmunityClaim } from "../../domain/night-effects";

/**
 * 本夜关系持原行动者／目标组件引用与当时捕获版本；可选回调仍归已付效果所有者。
 * 字段和嵌套对象未深冻结，Frame 沿同数组读取；这些运行引用不是可序列化数据或行动许可。
 */
export interface DreamNightLink {
  actorId: EntityId;
  targetId: EntityId;
  day: number;
  abilityId?: string;
  consecutive: boolean;
  isCurrent?: () => boolean;
  protectionPolicy?: import("../../domain/board").DreamProtectionPolicy;
  actorLife: AliveComponent;
  actorVersion: number | undefined;
  targetLife: AliveComponent;
  targetVersion: number | undefined;
}
type DreamReason = Extract<GameEvent, { type: "dream_death" }>["payload"];
const committedNights = new WeakMap<World, Set<number>>();
export function markDreamNightCommitted(world: World, day: number): void {
  const days = committedNights.get(world) ?? new Set<number>();
  days.add(day);
  committedNights.set(world, days);
}
export function hasDreamNightCommit(world: World, day: number): boolean {
  return committedNights.get(world)?.has(day) === true;
}

/** 一夜效果保持同一运行实例；接口不把私有原因、去重或原生命结构变成 JSON 数据。 */
export class DreamNightFrame implements DreamNightEffects {
  private readonly reasons = new Map<EntityId, DreamReason[]>();
  private readonly emitted = new Set<string>();
  private readonly shelters: readonly NightImmunityClaim[];
  constructor(
    private readonly links: readonly DreamNightLink[],
    shelters: readonly NightImmunityClaim[] = [],
  ) {
    // 在原构造点捕获庇护目标；回调绑定原 claim 接收方，已付 owner 仍可在后续查询撤权。
    this.shelters = shelters.map((claim) => ({
      target: { id: claim.target.id, life: claim.target.life, version: claim.target.version },
      isCurrent: claim.isCurrent.bind(claim),
    }));
  }

  private sheltered(
    world: World,
    targetId: EntityId,
    eligibleDead: ReadonlySet<EntityId> = new Set(),
  ): boolean {
    return this.shelters.some(
      ({ target, isCurrent }) =>
        target.id === targetId &&
        isCurrent() &&
        world.getComponent(targetId, COMPONENT.Alive) === target.life &&
        (target.life.alive
          ? aliveLifeVersion(target.life) === target.version
          : eligibleDead.has(targetId) && aliveLifeVersion(target.life) === target.version + 1),
    );
  }

  private targetCurrent(world: World, link: DreamNightLink): boolean {
    return (
      world.getComponent(link.targetId, COMPONENT.Alive) === link.targetLife &&
      link.targetLife.alive &&
      link.targetVersion !== undefined &&
      aliveLifeVersion(link.targetLife) === link.targetVersion
    );
  }
  // 只接本波 eligible 集合中的同原目标首次死亡（版本仅 +1）；替换或复活后的生命不复用。
  private targetDeathCurrent(
    world: World,
    link: DreamNightLink,
    eligible: ReadonlySet<EntityId>,
  ): boolean {
    return (
      eligible.has(link.targetId) &&
      world.getComponent(link.targetId, COMPONENT.Alive) === link.targetLife &&
      !link.targetLife.alive &&
      link.targetVersion !== undefined &&
      aliveLifeVersion(link.targetLife) === link.targetVersion + 1
    );
  }
  // 已付梦允许同原行动者首死亡后的连锁，但仍检查回调、原组件和捕获版本，不无条件保留效果。
  private actorCurrent(world: World, link: DreamNightLink): boolean {
    return (
      (link.isCurrent?.() ?? true) &&
      world.getComponent(link.actorId, COMPONENT.Alive) === link.actorLife &&
      link.actorVersion !== undefined &&
      aliveLifeVersion(link.actorLife) === link.actorVersion + (link.actorLife.alive ? 0 : 1)
    );
  }
  protectedTargets(world: World): EntityId[] {
    return [
      ...new Set(
        this.links
          .filter((link) => this.targetCurrent(world, link) && this.actorCurrent(world, link))
          .map((link) => link.targetId),
      ),
    ];
  }
  immuneNightTargets(world: World): EntityId[] {
    return this.links
      .filter(
        (link) =>
          link.protectionPolicy === "netease_2026_night_immunity_v1" &&
          this.targetCurrent(world, link) &&
          this.actorCurrent(world, link),
      )
      .map((link) => link.targetId);
  }
  blocksNightShot(world: World, targetId: EntityId): boolean {
    return this.protectedTargets(world).includes(targetId);
  }
  blocksNightCharm(world: World, targetId: EntityId, eligibleDead: ReadonlySet<EntityId>): boolean {
    return this.links.some(
      (link) =>
        link.targetId === targetId &&
        this.actorCurrent(world, link) &&
        (this.targetCurrent(world, link) || this.targetDeathCurrent(world, link, eligibleDead)),
    );
  }

  consecutiveDeaths(world: World): EntityId[] {
    // 累计原因但不标死；后续 record 仍使用这一实例，不能另造 frame 丢失已发生前缀。
    const deaths = new Set<EntityId>();
    for (const link of this.links)
      if (
        link.consecutive &&
        this.targetCurrent(world, link) &&
        this.actorCurrent(world, link) &&
        !this.sheltered(world, link.targetId)
      ) {
        deaths.add(link.targetId);
        this.reason(link, "consecutive");
      }
    return [...deaths];
  }
  private reason(link: DreamNightLink, reason: DreamReason["reason"]): void {
    const facts = this.reasons.get(link.targetId) ?? [];
    if (
      !facts.some(
        (fact) =>
          fact.actorId === link.actorId &&
          fact.abilityId === link.abilityId &&
          fact.reason === reason,
      )
    )
      facts.push({
        actorId: link.actorId,
        targetId: link.targetId,
        day: link.day,
        reason,
        ...(link.abilityId ? { abilityId: link.abilityId } : {}),
      });
    this.reasons.set(link.targetId, facts);
  }
  linkedDeaths(
    world: World,
    nightDeaths: readonly EntityId[],
    eligibleDead: ReadonlySet<EntityId> = new Set(),
  ): EntityId[] {
    const deaths = new Set(nightDeaths),
      // 按原有限闭包顺序加入关联原因；允许本波已死亡的原目标，庇护和当前性仍现场查询。
      added = new Set<EntityId>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const link of this.links)
        if (
          deaths.has(link.actorId) &&
          this.actorCurrent(world, link) &&
          !this.sheltered(world, link.targetId, eligibleDead) &&
          (this.targetCurrent(world, link) || this.targetDeathCurrent(world, link, eligibleDead))
        ) {
          added.add(link.targetId);
          this.reason(link, "linked");
          if (!deaths.has(link.targetId)) {
            deaths.add(link.targetId);
            changed = true;
          }
        }
    }
    return [...added];
  }
  expandInitialDamage(world: World, damage: DamageResolutionResult): void {
    for (const targetId of this.linkedDeaths(world, damage.deaths)) {
      if (!damage.deaths.includes(targetId)) damage.deaths.push(targetId);
      damage.deathSources[targetId] = [
        ...new Set([...(damage.deathSources[targetId] ?? []), DeathCause.Dream]),
      ];
    }
  }
  recordDeaths(deadIds: readonly EntityId[], events: GameEvent[]): void {
    for (const targetId of deadIds)
      for (const fact of this.reasons.get(targetId) ?? []) {
        const key = `${fact.actorId}:${fact.abilityId ?? "native"}:${fact.targetId}:${fact.reason}`;
        if (this.emitted.has(key)) continue;
        // 去重先于事件写入；push 失败保留原 emitted 前缀，不重发或回滚已记录身份。
        this.emitted.add(key);
        events.push({ timestamp: Date.now(), type: "dream_death", payload: { ...fact } });
      }
  }
}
