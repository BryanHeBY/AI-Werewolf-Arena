/**
 * 负责按 World 隔离记录玩家自身已接受夜行动，并检查幸运儿／黑市受赠者的目标限制。
 * 输入为原 World、玩家、日次、行动种类与目标，输出为私有历史副本和目标可用判断。
 * 本模块唯一写入 WeakMap 账本；公共记录类型归数据契约，历史不代替许可、付款或公共事实。
 * 目标政策仍是行动者本地规则，保留实例过期／转移后的原历史影响，不读取他人行动。
 */
import type { EntityId } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { RoleComponent } from "../../../core/domain/components/role";
import { COMPONENT } from "../../../core/domain/components/names";
import { allNightAbilities, type NightAbilityReadView } from "./abilities";
import type { NightActionKind, OwnNightAction } from "@ai-werewolf-arena/game-contract/night-ability-views";

const histories = new WeakMap<World, Map<EntityId, OwnNightAction[]>>();

/** 只记录调用方已接受的效果，不记尝试或他人目标；这次写入不证明实际付款／伤害完成。 */
export function recordOwnNightAction(
  world: World,
  actorId: EntityId,
  day: number,
  kind: NightActionKind,
  targetId: EntityId,
  lucky: boolean,
  recipientPolicy: "lucky" | "black_market" = "lucky",
): void {
  let actors = histories.get(world);
  if (!actors) {
    actors = new Map();
    histories.set(world, actors);
  }
  const previous = actors.get(actorId) ?? [];
  actors.set(actorId, [
    ...previous.filter((row) => row.day >= day - 1),
    { day, kind, targetId, lucky, ...(lucky ? { recipientPolicy } : {}) },
  ]);
}

export function ownNightActions(world: World, actorId: EntityId, day: number): OwnNightAction[] {
  // 保留原 day-1..day 过滤再逐行浅复制；不能把账本引用直接交给观察消费者或改写业务时钟。
  return (histories.get(world)?.get(actorId) ?? [])
    .filter((row) => row.day >= day - 1 && row.day <= day)
    .map((row) => ({ ...row }));
}

/** 即使原幸运实例过期、耗尽或已转移，目标限制仍按该行动者的原本地历史检查。 */
export function luckyTargetAllowed(
  world: World,
  actorId: EntityId,
  ability: NightAbilityReadView,
  day: number,
  kind: NightActionKind,
  targetId: EntityId,
): boolean {
  const history = ownNightActions(world, actorId, day);
  const role = world.getComponent(actorId, COMPONENT.Role);
  const abilityKind = kind === "check" ? "seer_check" : kind === "poison" ? "potion" : "guard";
  const hasPolicy =
    ability.activation === "lucky" ||
    ability.activation === "black_market" ||
    allNightAbilities(role).some(
      (a) =>
        a.kind === abilityKind && (a.activation === "lucky" || a.activation === "black_market"),
    ) ||
    history.some((row) => row.kind === kind && row.lucky);
  if (!hasPolicy) return true;
  if (
    (ability.activation === "lucky" || ability.activation === "black_market") &&
    kind === "check" &&
    targetId === actorId
  )
    return false;
  return !history.some(
    (row) =>
      row.kind === kind &&
      row.targetId === targetId &&
      (row.day === day || (kind === "guard" && row.day === day - 1)),
  );
}
