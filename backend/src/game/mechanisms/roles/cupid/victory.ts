import {
  COMPONENT,
  Camp,
  type World,
  type RoleComponent,
  type WinDecision,
} from "../../../../core/domain";
import { victoryDecision } from "../../win_conditions/results";
import { loversRecord, livingOriginalLovers } from "./relation";
/** A finite City-only sourced board contribution, evaluated after complete death chains. */
export function cupidCityDecision(world: World): { decision: WinDecision | null } | null {
  const record = loversRecord(world);
  if (!record) return null;
  const group = new Set<number>(record.pairIds);
  const follows = record.policy === "netease_2017_cupid_follows_lovers_v1";
  if (follows) group.add(record.actorId);
  const alive = world.getAliveEntityIds();
  if (record.mixed && livingOriginalLovers(world) && alive.every((id) => group.has(id)))
    return {
      decision: victoryDecision(
        world,
        { kind: "relationship", groupId: record.groupId },
        "cupid_lovers_only_survivors",
      ),
    };
  let wolves = 0,
    good = 0;
  for (const id of alive) {
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
    if (role?.camp === Camp.Wolf) wolves++;
    if (
      role?.camp === Camp.Good &&
      !(follows && id === record.actorId && (record.mixed || record.pairCamps[0] === Camp.Wolf))
    )
      good++;
  }
  return {
    decision:
      wolves === 0
        ? victoryDecision(world, { kind: "faction", faction: Camp.Good }, "all_wolves_eliminated")
        : good === 0
          ? victoryDecision(world, { kind: "faction", faction: Camp.Wolf }, "all_good_eliminated")
          : null,
  };
}
