import { AliveComponent } from "../components/alive";
import { COMPONENT } from "../components/names";
import { StatusMarksComponent } from "../components/status_marks";
import { EntityId, StatusMark } from "../model";
import { World } from "../world";

export interface DamageResolutionResult {
  deaths: EntityId[];
  deathSources: Record<number, StatusMark[]>;
}

/**
 * 黎明伤害结算系统：
 * - 处理“同守同救”特殊规则
 * - 统一判定狼刀/毒药导致的死亡
 * - 结算后清空当夜印记
 */
export class DamageResolutionSystem {
  resolve(world: World): DamageResolutionResult {
    const deaths: EntityId[] = [];
    const deathSources: Record<number, StatusMark[]> = {};

    for (const entityId of world.getAliveEntityIds()) {
      const marks = world.getComponent<StatusMarksComponent>(
        entityId,
        COMPONENT.StatusMarks,
      );
      const alive = world.getComponent<AliveComponent>(entityId, COMPONENT.Alive);
      if (!marks || !alive) {
        continue;
      }

      const sources: StatusMark[] = [];
      const hasGuard = marks.has(StatusMark.GuardMark);
      const hasHeal = marks.has(StatusMark.HealMark);
      const hasWolfKill = marks.has(StatusMark.WolfKillMark);
      const hasPoison = marks.has(StatusMark.PoisonMark);

      if (hasGuard && hasHeal) {
        // 同守同救互相抵消，但若同时被狼刀命中仍会死亡。
        marks.remove(StatusMark.GuardMark);
        marks.remove(StatusMark.HealMark);
        if (hasWolfKill) {
          sources.push(StatusMark.WolfKillMark);
        }
      } else {
        if (hasPoison) {
          sources.push(StatusMark.PoisonMark);
        }
        if (hasWolfKill && !(hasGuard || hasHeal)) {
          sources.push(StatusMark.WolfKillMark);
        }
      }

      if (sources.length > 0) {
        alive.alive = false;
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
