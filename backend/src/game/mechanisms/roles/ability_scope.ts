/**
 * 捕获原角色、生命、状态、来源及政策身份的夜能力 owner。输入为已选择实例与阶段当前性
 * 回调；输出为原体当前性和行动资格检查。替换原槽或政策仍撤销 scope，不写状态或付款。
 * 阵营仅捕获晚取的当前值，同值组件替换不加引用撤权，缺失值仍按原值比较。
 * isOwnerCurrent 保原已付效果复验，不因运行授权墓碑失效；仅 isEligible 在原复验后拒绝退休演员。
 * 查验政策身份字节由该状态族的唯一 codec 在原表达式位置生成，生命、id、来源及允许
 * 首次死亡的版本判断仍只在此 owner，不因 payload 合法而重新授权。
 */
import type { NightAbilityKind } from "@ai-werewolf-arena/game-contract";

import { captureRadiantTurn } from "./radiant_eclipse/night_frame";
import { isRoleExecutionRetired } from "../../../core/domain/role-execution-authority";
import { COMPONENT } from "../../../core/domain/components/names";

import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import type { World } from "../../../core/domain/world";
import type { EntityId } from "../../../core/domain/model";
import { activeNightAbility, type NightAbilityReadView } from "./abilities";
import { aliveLifeVersion } from "../../../core/domain/components/alive";

import { DREAMER_STATE_SLOT } from "./dreamer/ports";
import { SHELTER_STATE_SLOT } from "./radiant_eclipse/shelter-state-slot";
import { SEER_STATE_SLOT } from "./seer/ports";
import { GUARD_STATE_SLOT } from "./guard/ports";
import { WITCH_STATE_SLOT } from "./witch/ports";
import { ROLE_INSPECTION_STATE_SLOT } from "./role_inspection/ports";

/** 即使库存对象仍同一引用，政策编辑也会改变授权身份。 */
function policyIdentity(ability: NightAbilityReadView): string {
  switch (ability.kind) {
    case "pair_check":
      return JSON.stringify([ability.state.policy]);
    case "shelter":
      return SHELTER_STATE_SLOT.invalidations.policyIdentity(ability);
    case "seer_check":
      return SEER_STATE_SLOT.invalidations.policyIdentity(ability);
    case "potion":
      return WITCH_STATE_SLOT.invalidations.policyIdentity(ability);
    case "guard":
      return GUARD_STATE_SLOT.invalidations.policyIdentity(ability);
    case "role_check":
      return ROLE_INSPECTION_STATE_SLOT.checkpoint.policyIdentity(ability);
    case "dream":
      return DREAMER_STATE_SLOT.invalidations.policyIdentity(ability);
  }
}

/** 请求动作前先捕获；只读资格仍在实际提交时重检，不因捕获而冻结演员。 */
export function captureNightAbilityScope<K extends NightAbilityKind>(
  world: World,
  actorId: EntityId,
  ability: NightAbilityReadView<K>,
  day: number,
  phaseCurrent: () => boolean,
) {
  const role = world.getComponent(actorId, COMPONENT.Role),
    life = captureNightLife(world, actorId);
  if (!role || !life) return null;
  const radiantCurrent = captureRadiantTurn(world, actorId, ability, day);
  const roleKind = role.role,
    camp = world.getComponent(actorId, COMPONENT.Camp)?.camp,
    privateState = role.privateState;
  const state = ability.state,
    kind = ability.kind,
    activation = ability.activation,
    id = ability.id;
  const source = ability.source,
    sourceKind = source.kind,
    sourceOwner = source.kind === "native" ? source.role : source.actorId,
    sourceId = source.kind === "copy" || source.kind === "transfer" ? source.abilityId : undefined;
  const policy = policyIdentity(ability);
  const starts = ability.startsOnDay,
    expires = ability.expiresAfterDay,
    maxUses = ability.maxUses,
    disclosed = ability.sourceDisclosed;
  const ownerCurrent = (allowFirstDeath = false) =>
    phaseCurrent() &&
    world.getComponent(actorId, COMPONENT.Role) === role &&
    role.role === roleKind &&
    world.getComponent(actorId, COMPONENT.Camp)?.camp === camp &&
    role.privateState === privateState &&
    (livingNightLife(world, life) ||
      (allowFirstDeath &&
        world.getComponent(actorId, COMPONENT.Alive) === life.life &&
        !life.life.alive &&
        aliveLifeVersion(life.life) === life.version + 1)) &&
    ability.id === id &&
    ability.kind === kind &&
    ability.activation === activation &&
    ability.state === state &&
    policyIdentity(ability) === policy &&
    (
      (role.privateState as { readonly abilities?: unknown }).abilities as
        Readonly<Record<string, NightAbilityReadView>> | undefined
    )?.[id] === ability &&
    ability.source === source &&
    source.kind === sourceKind &&
    (source.kind === "native" ? source.role : source.actorId) === sourceOwner &&
    (source.kind === "copy" || source.kind === "transfer" ? source.abilityId : undefined) ===
      sourceId &&
    ability.startsOnDay === starts &&
    ability.expiresAfterDay === expires &&
    ability.maxUses === maxUses &&
    ability.sourceDisclosed === disclosed;
  return {
    role,
    life,
    state,
    isOwnerCurrent: ownerCurrent,
    isEligible: () =>
      radiantCurrent() &&
      ownerCurrent() &&
      // 原体仍可能服务已付效果；墓碑只阻止新的行动资格，不改 ownerCurrent 或资源数据。
      !isRoleExecutionRetired(role) &&
      activeNightAbility(role, kind, day, id) === ability,
  };
}
