/**
 * 负责雾鸦夜间伤害交接与有界蛇反应窗口。输入为原生命和脱离的待结算伤害；
 * 输出为已 claim 的反应和最终伤害。finish／abort 终止本次 pending，不替换任何目标原体。
 * 本模块不切换阶段或标死；延期副本保留真实毒因果，疗救和梦扩展仍用原政策。
 * 规则依据：docs/rules/awa-mist-raven-twelve-v1.md。
 */
import {
  AliveComponent,
  aliveLifeDescriptor,
  aliveLifeVersion,
} from "../../../../domain/components/alive";
import { COMPONENT } from "../../../../domain/components/names";
import { DeathCause } from "../../../../domain/deaths";
import type { World } from "../../../../domain/world";
import { attachDamagePoisonEvidence, damagePoisonRoutes } from "../../../../domain/damage-evidence";
import type { DamageResolutionResult } from "../../../../domain/systems/damage-resolution-system";
import type { DreamNightEffects } from "../../../../domain/dream-night-effects";

type PendingStatus = "pending" | "committing" | "committed" | "aborted";
interface OriginalLife {
  readonly life: AliveComponent;
  readonly version: number;
}
function copyDamage(damage: DamageResolutionResult): DamageResolutionResult {
  const copy = {
    deaths: [...damage.deaths],
    deathSources: Object.fromEntries(
      damage.deaths.map((id) => [id, [...(damage.deathSources[id] ?? [])]]),
    ),
  };
  // 使用原复制时点的最终死因过滤证据；疗救或扩展不凭空制造原毒来源。
  return attachDamagePoisonEvidence(copy, damagePoisonRoutes(damage).filter(
    (route) => copy.deaths.includes(route.targetId) &&
      copy.deathSources[route.targetId]?.includes(DeathCause.Poison),
  ));
}
function factoryLife(life: AliveComponent): boolean {
  const original = aliveLifeDescriptor(life);
  if (!original) return false;
  const current = Object.getOwnPropertyDescriptor(life, "alive");
  return (
    !!original &&
    !!current &&
    current.get === original.get &&
    current.set === original.set &&
    current.enumerable === original.enumerable &&
    current.configurable === original.configurable
  );
}

/** 单次延期夜只归所属 PhaseManager；这里不提交阶段或死亡。 */
export class MistPendingNight {
  private currentStatus: PendingStatus = "pending";
  private readonly lives = new Map<number, OriginalLife>();
  private readonly directDamage: DamageResolutionResult;
  private finalDamage: DamageResolutionResult | undefined;
  private preparing = false;
  private finishing = false;
  private validating = false;

  constructor(
    private readonly world: World,
    readonly day: number,
    readonly wolfTarget: number | null,
    directDamage: DamageResolutionResult,
    private readonly dreams: DreamNightEffects,
  ) {
    if (!Number.isSafeInteger(day) || day < 1 || day >= Number.MAX_SAFE_INTEGER)
      throw new Error("mist_pending_night_invalid");
    // 后续梦关联目标未必在直接死亡名单中，原生命捕获仍覆盖潜在闭包。
    for (const id of world.entityIds()) {
      const life = world.getComponent(id, COMPONENT.Alive);
      if (!life) continue;
      if (!factoryLife(life)) throw new Error("mist_pending_life_invalid");
      const version = life && aliveLifeVersion(life);
      if (!life || version === undefined) throw new Error("mist_pending_life_invalid");
      if (life.alive) this.lives.set(id, Object.freeze({ life, version }));
    }
    if (
      (wolfTarget !== null && !this.lives.has(wolfTarget)) ||
      new Set(directDamage.deaths).size !== directDamage.deaths.length ||
      Object.keys(directDamage.deathSources).some(
        (key) => !directDamage.deaths.includes(Number(key)),
      ) ||
      directDamage.deaths.some(
        (id) =>
          !this.lives.has(id) ||
          !directDamage.deathSources[id]?.length ||
          directDamage.deathSources[id]!.some(
            (source) => !Object.values(DeathCause).includes(source),
          ),
      )
    )
      throw new Error("mist_pending_damage_invalid");
    this.directDamage = copyDamage(directDamage);
  }

  get status(): PendingStatus {
    return this.currentStatus;
  }

  private livingOriginal(id: number): boolean {
    const scope = this.lives.get(id);
    return (
      !!scope &&
      this.world.getComponent(id, COMPONENT.Alive) === scope.life &&
      factoryLife(scope.life) &&
      scope.life.alive &&
      aliveLifeVersion(scope.life) === scope.version
    );
  }

  /** 原刀口受保护或公开自爆死亡后仍保留原可知范围，不据当前角色重建刀源。 */
  snakeTargets(actorId: number): number[] {
    return this.wolfTarget !== null &&
      this.livingOriginal(this.wolfTarget) &&
      (this.wolfTarget !== actorId || this.day === 1)
      ? [this.wolfTarget]
      : [];
  }

  /** 包括自爆路径，均在警徽／蛇行动或其他 await 前同步领取这次延期，不能重入。 */
  claim(isCurrent: () => boolean): void {
    if (this.currentStatus !== "pending") throw new Error("mist_pending_night_reentry");
    this.currentStatus = "committing";
    this.requireCurrent(isCurrent);
  }

  private requireCurrent(isCurrent: () => boolean): void {
    let current: boolean;
    this.validating = true;
    try {
      current = isCurrent();
    } catch (error) {
      this.abort();
      throw error;
    } finally {
      this.validating = false;
    }
    if (!current || this.currentStatus !== "committing") {
      this.abort();
      throw new Error("mist_pending_night_stale");
    }
  }

  /** 只使用已解析的直接来源，不再次消费印记；疗救后在原时点展开梦关联。 */
  prepareFinalDamage(
    healedTarget: number | null,
    isCurrent: () => boolean,
  ): DamageResolutionResult {
    if (this.currentStatus !== "committing" || this.preparing || this.validating)
      throw new Error("mist_pending_night_reentry");
    this.preparing = true;
    this.requireCurrent(isCurrent);
    if (
      healedTarget !== null &&
      (healedTarget !== this.wolfTarget || !this.livingOriginal(healedTarget))
    ) {
      this.abort();
      throw new Error("mist_pending_heal_invalid");
    }
    const damage = copyDamage(this.directDamage);
    for (const id of damage.deaths) {
      if (!this.livingOriginal(id)) delete damage.deathSources[id];
      else if (id === healedTarget)
        damage.deathSources[id] = damage.deathSources[id]!.filter(
          (source) => source !== DeathCause.WolfKill,
        );
    }
    damage.deaths = damage.deaths.filter((id) => !!damage.deathSources[id]?.length);
    for (const id of Object.keys(damage.deathSources).map(Number))
      if (!damage.deaths.includes(id)) delete damage.deathSources[id];
    // 蛇行动结束后才扩展一次梦死因；梦的行动者／目标可能在直接死亡名单之外。
    for (const [id, scope] of this.lives) {
      if (this.world.getComponent(id, COMPONENT.Alive) === scope.life && !factoryLife(scope.life)) {
        this.abort();
        throw new Error("mist_pending_life_invalid");
      }
    }
    try {
      this.dreams.expandInitialDamage(this.world, damage);
    } catch (error) {
      this.abort();
      throw error;
    }
    if (this.currentStatus !== "committing") throw new Error("mist_pending_night_stale");
    this.finalDamage = copyDamage(damage);
    return copyDamage(damage);
  }

  /** 只在 DeathResolution 已提交准备的原生命之后完成本次延期。 */
  finish(isCurrent: () => boolean): void {
    if (
      this.currentStatus !== "committing" ||
      !this.finalDamage ||
      this.finishing ||
      this.validating
    )
      throw new Error("mist_pending_night_reentry");
    this.finishing = true;
    this.requireCurrent(isCurrent);
    if (
      this.finalDamage.deaths.some((id) => {
        const scope = this.lives.get(id);
        return (
          !scope ||
          this.world.getComponent(id, COMPONENT.Alive) !== scope.life ||
          !factoryLife(scope.life) ||
          scope.life.alive ||
          aliveLifeVersion(scope.life) !== scope.version + 1
        );
      })
    ) {
      this.abort();
      throw new Error("mist_pending_night_unsettled");
    }
    this.currentStatus = "committed";
  }

  abort(): void {
    if (this.currentStatus === "pending" || this.currentStatus === "committing")
      this.currentStatus = "aborted";
  }
}
