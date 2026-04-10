import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { Camp, GameResult, Role, WinCondition } from "../../domain/model";
import { World } from "../../domain/world";
import { WinConditionSpec } from "./contracts";

const GOD_ROLES = new Set<Role>([
  Role.Seer,
  Role.Guard,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
]);

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

    if (GOD_ROLES.has(roleComp.role)) {
      stat.gods += 1;
    } else if (roleComp.role === Role.Villager) {
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
];
