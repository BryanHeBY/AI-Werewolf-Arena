/**
 * 负责丘比特城市胜利贡献，输入保原情侣记录与存活名单，输出为原关系／阵营决策。
 * 真实当前 Camp 仅在原阵营点读取，历史 pairCamps 仍保捕获含义；不改情侣或标死玩家。
 */
import { COMPONENT, Camp, type World, type RoleComponent, type WinDecision } from "../../domain";
import { victoryDecision } from "../../engine/victory/results";
import { loversRecord, livingOriginalLovers } from "./relation";
/** 有限 City 板贡献只在完整死亡链之后判断，不把局部死亡提案当最终名单。 */
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
    const role = world.getComponent(id, COMPONENT.Role);
    if (role && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf) wolves++;
    if (
      role &&
      world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Good &&
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
