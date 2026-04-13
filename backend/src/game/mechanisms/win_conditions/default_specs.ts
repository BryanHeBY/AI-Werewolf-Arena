/** 文件说明：内置胜利条件规格实现。 */
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { Camp, GameResult, WinCondition } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { getDefaultRoleProfileRegistry } from "../roles/profile_registry";
import { WinConditionSpec } from "./contracts";

interface AliveStat {
  wolves: number;
  gods: number;
  villagers: number;
  good: number;
}

function statAlive(world: World): AliveStat {
  const stat: AliveStat = {
    wolves: 0,
    gods: 0,
    villagers: 0,
    good: 0,
  };

  for (const id of world.getAliveEntityIds()) {
    const roleComp = world.getComponent<RoleComponent>(id, COMPONENT.Role);
    if (!roleComp) {
      continue;
    }

    if (roleComp.camp === Camp.Wolf) {
      stat.wolves += 1;
      continue;
    }

    if (roleComp.camp === Camp.Good) {
      stat.good += 1;
    }

    const profile = getDefaultRoleProfileRegistry().get(roleComp.role);
    if (profile?.goodSide === "god") {
      stat.gods += 1;
    } else if (profile?.goodSide === "villager") {
      stat.villagers += 1;
    }
  }

  return stat;
}

function evaluateSlaughterCity(world: World): GameResult | null {
  const stat = statAlive(world);
  if (stat.wolves === 0) {
    return { winner: Camp.Good, reason: "all_wolves_eliminated" };
  }
  if (stat.good === 0) {
    return { winner: Camp.Wolf, reason: "all_good_eliminated" };
  }
  return null;
}

function evaluateSlaughterSide(world: World): GameResult | null {
  const stat = statAlive(world);
  if (stat.wolves === 0) {
    return { winner: Camp.Good, reason: "all_wolves_eliminated" };
  }
  if (stat.gods === 0 || stat.villagers === 0) {
    return { winner: Camp.Wolf, reason: "slaughter_side_completed" };
  }
  return null;
}

function evaluateWolfReachHalf(world: World): GameResult | null {
  const stat = statAlive(world);
  if (stat.wolves === 0) {
    return { winner: Camp.Good, reason: "all_wolves_eliminated" };
  }
  if (stat.wolves >= stat.good && stat.good > 0) {
    return { winner: Camp.Wolf, reason: "wolves_reach_half" };
  }
  return null;
}

/** 默认胜利条件规格集合。 */
export const DEFAULT_WIN_CONDITION_SPECS: WinConditionSpec[] = [
  {
    id: WinCondition.SlaughterCity,
    description: "屠城局：好人全灭或狼人全灭。",
    evaluate: evaluateSlaughterCity,
  },
  {
    id: WinCondition.SlaughterSide,
    description: "屠边局：神民任一边全灭或狼人全灭。",
    evaluate: evaluateSlaughterSide,
  },
  {
    id: WinCondition.WolfReachHalf,
    description: "狼人达半：存活狼人数量大于等于存活好人数量时，狼人胜利。",
    evaluate: evaluateWolfReachHalf,
  },
];
