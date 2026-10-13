/**
 * 负责黎明伤害结算：输入为当前夜间印记以及有来源的保护、查验和反击声明；
 * 输出为待结算死亡 ID、死因与仅供全知视角的反射证据，并按原顺序清理已消费印记。
 * 效果折叠和单目标政策委托具体 owner；本模块拥有取消冲突保护与清理印记的写权限。
 * 不修改 Alive 或执行死亡钩子，这两项由死亡结算负责；失败保留已经生效的清理前缀。
 */
import { COMPONENT } from "../components/names";
import { EntityId, StatusMark, type DeathSources } from "../model";
import { World } from "../world";
import type { NightPoisonReflection } from "../night_effects";
import { resolveNightDamageTarget } from "../night-damage-target";
import { planNightDamage, type NightDamageEffects } from "../night-damage-plan";

/**
 * 黎明伤害结算结果。
 */
export interface DamageResolutionResult {
  deaths: EntityId[];
  deathSources: DeathSources;
  /** 全知视角的因果输出；不进入玩家夜间摘要或状态。 */
  poisonReflections?: readonly NightPoisonReflection[];
}

/**
 * 黎明伤害结算系统：
 * - 处理“同守同救”特殊规则
 * - 统一判定狼刀/毒药导致的死亡
 * - 结算后清空当夜印记
 * - 仅返回“待结算死亡名单”，不在此处直接改写存活状态
 */
export class DamageResolutionSystem {
  /**
   * 执行一轮夜间伤害结算并返回死亡与死因信息。
   */
  resolve(world: World, effects: NightDamageEffects = {}): DamageResolutionResult {
    const deaths: EntityId[] = [];
    const deathSources: DeathSources = {};
    const plan = planNightDamage(world, effects);
    const {
      awakenedAttacks,
      mechanical,
      blackBacklashes,
      radiantBacklashes,
      backlashTargets,
      foxInspections,
      inspectionSources,
      passiveImmuneTargets,
    } = plan;
    for (const entityId of world.getAliveEntityIds()) {
      const marks = world.getComponent(entityId, COMPONENT.StatusMarks);
      if (passiveImmuneTargets.has(entityId)) {
        marks?.clear();
        continue;
      }
      if (
        !marks &&
        !foxInspections.has(entityId) &&
        !inspectionSources.has(entityId) &&
        !effects.consecutiveDeaths?.includes(entityId) &&
        !mechanical.attacks.has(entityId) &&
        !awakenedAttacks.has(entityId) &&
        !mechanical.failures.has(entityId) &&
        !mechanical.reflectedPoisonTargets.has(entityId)
      ) {
        if (
          !backlashTargets.has(entityId) &&
          !blackBacklashes.has(entityId) &&
          !radiantBacklashes.has(entityId)
        )
          continue;
      }

      // 取消和最终清理分别执行，后续目标查询失败不能回滚前一目标的清理。
      const sources = resolveNightDamageTarget(world, entityId, effects, plan, marks, () => {
        marks?.remove(StatusMark.GuardMark);
        marks?.remove(StatusMark.HealMark);
      });
      if (sources.length > 0) {
        deaths.push(entityId);
        deathSources[entityId] = sources;
      }

      marks?.clear();
    }

    return {
      deaths,
      deathSources,
      ...(mechanical.reflections.length ? { poisonReflections: mechanical.reflections } : {}),
    };
  }
}
