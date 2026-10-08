import { COMPONENT } from "../components/names";
import { StatusMarksComponent } from "../components/status_marks";
import { EntityId, StatusMark, DeathCause, type DeathSources } from "../model";
import { World } from "../world";

/**
 * 黎明伤害结算结果。
 */
export interface DamageResolutionResult {
  deaths: EntityId[];
  deathSources: DeathSources;
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
  resolve(world: World): DamageResolutionResult {
    const deaths: EntityId[] = [];
    const deathSources: DeathSources = {};

    for (const entityId of world.getAliveEntityIds()) {
      const marks = world.getComponent<StatusMarksComponent>(
        entityId,
        COMPONENT.StatusMarks,
      );
      if (!marks) {
        continue;
      }

      const sources: DeathCause[] = [];
      const hasGuard = marks.has(StatusMark.GuardMark);
      const hasHeal = marks.has(StatusMark.HealMark);
      const hasWolfKill = marks.has(StatusMark.WolfKillMark);
      const hasPoison = marks.has(StatusMark.PoisonMark);
      // Poison is independent of protection and must survive a conflict.
      if (hasPoison) sources.push(DeathCause.Poison);

      if (hasGuard && hasHeal) {
        // 同守同救互相抵消，但若同时被狼刀命中仍会死亡。
        marks.remove(StatusMark.GuardMark);
        marks.remove(StatusMark.HealMark);
        if (hasWolfKill) {
          sources.push(DeathCause.WolfKill);
        }
      } else {
        if (hasWolfKill && !(hasGuard || hasHeal)) {
          sources.push(DeathCause.WolfKill);
        }
      }

      if (sources.length > 0) {
        deaths.push(entityId);
        deathSources[entityId] = sources;
      }

      marks.clear();
    }

    return {
      deaths,
      deathSources,
    };
  }
}
