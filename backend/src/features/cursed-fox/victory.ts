/**
 * 负责在原最终谓词通过时用狐狸独立胜利替换已有阵营结果；输入保 World 与原决策。
 * 只在原角色短路后晚读真实 Camp，不执行查验、伤害或重写归属；输出仍由原决策 owner 构造。
 */
import {
  COMPONENT,
  Role,
  Camp,
  type World,
  type WinDecision,
  type RoleComponent,
} from "../../domain";
import { victoryDecision } from "../../engine/victory/results";
import { CURSED_FOX_GOAL } from "./profile";
export function replaceWithFoxVictory(world: World, decision: WinDecision): WinDecision {
  if (
    decision.outcome.kind !== "victory" ||
    decision.outcome.primary.kind !== "faction" ||
    ![Camp.Good, Camp.Wolf].includes(decision.outcome.primary.faction as Camp)
  )
    return decision;
  const fox = world.getAliveEntityIds().find((id) => {
    const role = world.getComponent(id, COMPONENT.Role);
    return role?.role === Role.CursedFox && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.ThirdParty;
  });
  return fox === undefined
    ? decision
    : victoryDecision(
        world,
        { kind: "individual", goalId: CURSED_FOX_GOAL, playerId: fox },
        "cursed_fox_survived_faction_elimination",
      );
}
