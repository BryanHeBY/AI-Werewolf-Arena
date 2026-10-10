import { demonHunterIsGod } from "../roles/demon_hunter/authority";
import { weddingFactionResult } from "../roles/ghost_bride/authority";
/** 文件说明：内置胜利条件规格实现。 */
import { cupidCityDecision } from "../roles/cupid/victory";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { Camp, type WinDecision, WinCondition } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { getDefaultRoleCatalog } from "../roles/catalog";
import { WinConditionSpec } from "./contracts";
import { victoryDecision } from "./results";

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
      const profile = getDefaultRoleCatalog().get(roleComp.role);
      if (profile?.goodSide === "god" || demonHunterIsGod(world, roleComp)) stat.gods += 1;
      else if (profile?.goodSide === "villager") stat.villagers += 1;
    }
  }

  return stat;
}

function evaluateSlaughterCity(world: World): WinDecision | null {
  const cupid = cupidCityDecision(world);
  if (cupid) return cupid.decision;
  const stat = statAlive(world);
  if (stat.wolves === 0) {
    return victoryDecision(world, { kind: "faction", faction: Camp.Good }, "all_wolves_eliminated");
  }
  if (stat.good === 0) {
    return victoryDecision(world, { kind: "faction", faction: Camp.Wolf }, "all_good_eliminated");
  }
  return null;
}

function evaluateSlaughterSide(world: World): WinDecision | null {
  const stat = statAlive(world);
  if (stat.wolves === 0) {
    return victoryDecision(world, { kind: "faction", faction: Camp.Good }, "all_wolves_eliminated");
  }
  if (stat.gods === 0 || stat.villagers === 0) {
    return victoryDecision(
      world,
      { kind: "faction", faction: Camp.Wolf },
      "slaughter_side_completed",
    );
  }
  return null;
}

function evaluateWolfReachHalf(world: World): WinDecision | null {
  const stat = statAlive(world);
  if (stat.wolves === 0) {
    return victoryDecision(world, { kind: "faction", faction: Camp.Good }, "all_wolves_eliminated");
  }
  if (stat.wolves >= stat.good && stat.good > 0) {
    return victoryDecision(world, { kind: "faction", faction: Camp.Wolf }, "wolves_reach_half");
  }
  return null;
}

/** 默认胜利条件规格集合。 */
export const DEFAULT_WIN_CONDITION_SPECS: WinConditionSpec[] = [
  {
    id: WinCondition.ThreeFactionsElimination,
    checkpoints: ["night_settled", "exile_settled", "day_interrupted"],
    evaluate: (world) => {
      const result = weddingFactionResult(world);
      if (!result) return null;
      return result.faction === null
        ? { winner: null, reason: "three_factions_all_dead", outcome: { kind: "no_winner" } }
        : victoryDecision(
            world,
            { kind: "faction", faction: result.faction },
            "three_factions_eliminated",
          );
    },
  },
  {
    id: WinCondition.SlaughterCity,
    evaluate: evaluateSlaughterCity,
  },
  {
    id: WinCondition.SlaughterSide,
    evaluate: evaluateSlaughterSide,
  },
  {
    id: WinCondition.WolfReachHalf,
    evaluate: evaluateWolfReachHalf,
  },
];
