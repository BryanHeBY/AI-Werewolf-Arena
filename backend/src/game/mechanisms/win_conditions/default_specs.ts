/**
 * 负责按真实存活阵营统计定义配置的淘汰条件。输入为 World 与胜负配置；
 * 输出为屠城、屠边、狼半及既有特殊分支的候选结果，按原先后读取实际 Camp／角色元数据。
 * 配置工厂只替换两种淘汰条件的 evaluate，不修改缓存默认数组；未匹配规格保原引用。
 * 不封盘或执行死亡，判胜时点、关系领域和唯一终态仍由原 owner／引擎维护。
 */
import { ELIMINATION_PRIORITIES, type EliminationPriority } from "../../../domain/board";
import { demonHunterIsGod } from "../roles/demon_hunter/authority";
import { weddingFactionResult } from "../roles/ghost_bride/authority";
/** 文件说明：内置胜利条件规格实现。 */
import { cupidCityDecision } from "../roles/cupid/victory";
import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import { Camp, type WinDecision, WinCondition } from "../../../domain/model";
import { World } from "../../../domain/world";
import { getDefaultRoleCatalog } from "../roles/role-catalog-assembly";
import { WinConditionSpec } from "./contracts";
import { victoryDecision } from "./results";

/** 只统计真实存活Camp；good再按角色元数据／Demon规则区分god和villager，成员归属不等于真实Camp。 */
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
    const roleComp = world.getComponent(id, COMPONENT.Role);
    if (!roleComp) {
      continue;
    }

    // 两阵营分支各在原比较点晚读唯一Camp，缺失不以角色资料补成默认阵营。
    if (world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf) {
      stat.wolves += 1;
      continue;
    }

    if (world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Good) {
      stat.good += 1;
      const profile = getDefaultRoleCatalog().metadata(roleComp.role);
      if (profile?.goodSide === "god" || demonHunterIsGod(world, roleComp)) stat.gods += 1;
      else if (profile?.goodSide === "villager") stat.villagers += 1;
    }
  }

  return stat;
}

function evaluateSlaughterCity(
  world: World,
  priority: EliminationPriority = "awa_good_priority_v1",
): WinDecision | null {
  const cupid = cupidCityDecision(world);
  if (cupid) return cupid.decision;
  const stat = statAlive(world);
  if (priority === "awa_wolf_priority_v1" && stat.good === 0) {
    return victoryDecision(world, { kind: "faction", faction: Camp.Wolf }, "all_good_eliminated");
  }
  if (stat.wolves === 0) {
    return victoryDecision(world, { kind: "faction", faction: Camp.Good }, "all_wolves_eliminated");
  }
  if (stat.good === 0) {
    return victoryDecision(world, { kind: "faction", faction: Camp.Wolf }, "all_good_eliminated");
  }
  return null;
}

function evaluateSlaughterSide(
  world: World,
  priority: EliminationPriority = "awa_good_priority_v1",
): WinDecision | null {
  const stat = statAlive(world);
  if (priority === "awa_wolf_priority_v1" && (stat.gods === 0 || stat.villagers === 0)) {
    return victoryDecision(
      world,
      { kind: "faction", faction: Camp.Wolf },
      "slaughter_side_completed",
    );
  }
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
    evaluate: (world) => evaluateSlaughterCity(world),
  },
  {
    id: WinCondition.SlaughterSide,
    evaluate: (world) => evaluateSlaughterSide(world),
  },
  {
    id: WinCondition.WolfReachHalf,
    evaluate: evaluateWolfReachHalf,
  },
];

/** 创建每局淘汰政策规格，不改缓存默认数组；只替换两项对象，其他项保原引用，结果并未深冻结。 */
export function createEliminationWinConditionSpecs(
  priority: EliminationPriority,
): WinConditionSpec[] {
  if (!ELIMINATION_PRIORITIES.includes(priority)) throw new Error("elimination_priority_invalid");
  return DEFAULT_WIN_CONDITION_SPECS.map((spec) => {
    if (spec.id === WinCondition.SlaughterCity)
      return { ...spec, evaluate: (world: World) => evaluateSlaughterCity(world, priority) };
    if (spec.id === WinCondition.SlaughterSide)
      return { ...spec, evaluate: (world: World) => evaluateSlaughterSide(world, priority) };
    return spec;
  });
}
