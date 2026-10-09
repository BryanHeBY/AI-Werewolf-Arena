import {
  COMPONENT,
  Role,
  Camp,
  type World,
  type WinDecision,
  type RoleComponent,
} from "../../../../core/domain";
import { victoryDecision } from "../../win_conditions/results";
import { CURSED_FOX_GOAL } from "./profile";
export function replaceWithFoxVictory(world: World, decision: WinDecision): WinDecision {
  if (
    decision.outcome.kind !== "victory" ||
    decision.outcome.primary.kind !== "faction" ||
    ![Camp.Good, Camp.Wolf].includes(decision.outcome.primary.faction as Camp)
  )
    return decision;
  const fox = world.getAliveEntityIds().find((id) => {
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
    return role?.role === Role.CursedFox && role.camp === Camp.ThirdParty;
  });
  return fox === undefined
    ? decision
    : victoryDecision(
        world,
        { kind: "individual", goalId: CURSED_FOX_GOAL, playerId: fox },
        "cursed_fox_survived_faction_elimination",
      );
}
