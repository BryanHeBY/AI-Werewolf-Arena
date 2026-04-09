import { COMPONENT } from "../components/names";
import { RoleComponent } from "../components/role";
import { Camp, GameResult, Role, WinCondition } from "../model";
import { World } from "../world";

const GOD_ROLES = new Set<Role>([
  Role.Seer,
  Role.Guard,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
]);

/**
 * 胜负判定系统：
 * - 屠城局：好人全灭或狼人全灭
 * - 屠边局：神民任一边全灭或狼人全灭
 */
export class WinConditionSystem {
  /**
   * 根据当前存活结构判断是否触发终局。
   */
  evaluate(world: World, condition: WinCondition): GameResult | null {
    const aliveIds = world.getAliveEntityIds();

    let wolves = 0;
    let gods = 0;
    let villagers = 0;
    let good = 0;

    for (const id of aliveIds) {
      const roleComp = world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (!roleComp) {
        continue;
      }

      if (roleComp.camp === Camp.Wolf) {
        wolves += 1;
        continue;
      }

      if (roleComp.camp === Camp.Good) {
        good += 1;
      }

      if (GOD_ROLES.has(roleComp.role)) {
        gods += 1;
      } else if (roleComp.role === Role.Villager) {
        villagers += 1;
      }
    }

    if (condition === WinCondition.SlaughterCity) {
      if (wolves === 0) {
        return { winner: Camp.Good, reason: "all_wolves_eliminated" };
      }
      if (good === 0) {
        return { winner: Camp.Wolf, reason: "all_good_eliminated" };
      }
      return null;
    }

    if (wolves === 0) {
      return { winner: Camp.Good, reason: "all_wolves_eliminated" };
    }

    if (gods === 0 || villagers === 0) {
      return { winner: Camp.Wolf, reason: "slaughter_side_completed" };
    }

    return null;
  }
}
