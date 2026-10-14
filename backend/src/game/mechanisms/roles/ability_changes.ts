/**
 * 负责普通夜能力原生安装、起效日、启停、次数、首次死亡到期及借用实例退役。
 * 输入为原角色／实例、状态与业务日期；输出保留同一库存引用和能力变化事实。授予、复制、转移完整流程归 night-ability-grants。
 * 本模块只写原生安装及公共 metadata；具体 payload 库存、临时抑制、原体／生命和提交许可仍归原负责人。
 * 共用角色查询／发布唯一消费 night-ability-change-runtime，保留原 clone、getter、字段和部分失败前缀，不退款。
 */
import type {
  NightAbilityKind,
  NightAbilityStates,
  NightAbilityReadState,
  RoleInspectionState,
} from "@ai-werewolf-arena/game-contract";

import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import { Role, type EntityId, type GameEvent } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import { allNightAbilities, abilityStatus, projectPairState, copyAbilityData, type NightAbilityReadView } from "./abilities";
import { roleOf, emit } from "./night-ability-change-runtime";

import { commitPreparedNativeAbility } from "./prepared-native-install";
import { DREAMER_STATE_SLOT } from "./dreamer/ports";
import { SHELTER_STATE_SLOT } from "./radiant_eclipse/shelter-state-slot";
import { SEER_STATE_SLOT } from "./seer/ports";
import { GUARD_STATE_SLOT } from "./guard/ports";
import { WITCH_STATE_SLOT } from "./witch/ports";
import { ROLE_INSPECTION_STATE_SLOT } from "./role_inspection/ports";

export function setNightAbilityEnabled(
  world: World,
  actorId: EntityId,
  id: string,
  enabled: boolean,
  events: GameEvent[],
): void {
  const ability = allNightAbilities(roleOf(world, actorId)).find((ability) => ability.id === id);
  if (!ability) throw new Error("ability_instance_missing");
  if (enabled && ability.deathExpired) throw new Error("ability_lucky_expired_on_death");
  if (ability.disabled === !enabled) return;
  (ability as { disabled: boolean }).disabled = !enabled;
  emit(events, actorId, ability, enabled ? "enabled" : "disabled");
}

/**
 * 退役角色已核对原体／捕获槽的借用实例，只重定义原 disabled 数据属性。
 * 目标 supplier 在 Object.defineProperty 方法查找之后执行，保原 late 字段读取位置。
 * 不按可变 id 重查、不读或执行替换的 disabled getter/setter、不删槽／退休 ID，不发布启停事实。
 * 借用租约、原主抑制和已付 payload 仍归具体 Frame；本写入不提供新行动权限或退款。
 */
export function retireBorrowedNightAbility(readBorrowed: () => NightAbilityReadView): void {
  Object.defineProperty(readBorrowed(), "disabled", {
    value: true,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** 实际死亡到期跟随同一实例经过转移／复活；已经付款的夜效果仍按原政策保留。 */
export function expireLuckyAbilitiesOnDeath(
  world: World,
  actorId: EntityId,
  events: GameEvent[],
): void {
  for (const ability of allNightAbilities(world.getComponent(actorId, COMPONENT.Role))) {
    if (
      (ability.activation !== "lucky" && ability.activation !== "black_market") ||
      ability.deathExpired
    )
      continue;
    (ability as { deathExpired?: boolean }).deathExpired = true;
    (ability as { disabled: boolean }).disabled = true;
    emit(events, actorId, ability, "disabled");
  }
}

/** 原生安装先完成原 copy／policy，再写实际 abilities 槽；不提前读取退休 ID 或更换私有容器。 */
export function installNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  state: NightAbilityStates[K],
): NightAbilityReadState<K> {
  if (kind === "pair_check" && role.role !== Role.AwakenedSeer)
    throw Error("ability_pair_native_role_invalid");
  const ownedState = (
    kind === "pair_check"
      ? copyAbilityData(projectPairState(state))
      : kind === "role_check"
        ? ROLE_INSPECTION_STATE_SLOT.create(state as RoleInspectionState)
        : kind === "seer_check"
          ? SEER_STATE_SLOT.create(state as NightAbilityStates["seer_check"])
          : kind === "guard"
            ? GUARD_STATE_SLOT.create(state as NightAbilityStates["guard"])
            : kind === "potion"
              ? WITCH_STATE_SLOT.create(state as NightAbilityStates["potion"])
              : kind === "dream"
                ? DREAMER_STATE_SLOT.create(state as NightAbilityStates["dream"])
                : kind === "shelter"
                  ? SHELTER_STATE_SLOT.prepare(state as NightAbilityStates["shelter"])
                  : copyAbilityData(state)
  ) as NightAbilityStates[K];
  return commitPreparedNativeAbility(role, kind, ownedState);
}

/** 初始化／学习流程仍在原调用点决定起效日；这里只写原 startsOnDay，不推进业务时钟。 */
export function setNightAbilityStartDay(ability: NightAbilityReadView, day: number): void {
  (ability as { startsOnDay: number }).startsOnDay = day;
}

/** 原 status 重检后先记 lastUsedDay，再可选增加 uses；payload 库存与已付效果继续归具体机制。 */
export function recordNightAbilityUse(
  ability: NightAbilityReadView,
  day: number,
  consumed: boolean,
): void {
  if (abilityStatus(ability, day) !== "active") throw new Error("ability_not_active");
  (ability as { lastUsedDay: number | null }).lastUsedDay = day;
  if (consumed) (ability as { uses: number }).uses++;
}
