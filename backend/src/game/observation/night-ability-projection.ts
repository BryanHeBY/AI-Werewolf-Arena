/**
 * 负责夜能力来源披露、七类 payload 裁剪和完整玩家能力 DTO。输入为原只读实例与明确日次，
 * 输出保持原字段／getter顺序的独立数据；来源未披露时仅返回 kind，不读取隐藏身份字段。
 * projectNightState 同时供黑市转移的复制与完整性检查使用，不能当作安装／付款或行动许可。
 * Pair 规范化、disabled 查询与 status 仍归能力／数据所有者；不复制规则、缓存字段、写库存，
 * 首个读取／投影错误保留调用前缀，不代替原生命、来源、阶段和租约复验。
 */
import type { AbilitySource, NightAbilityKind } from "@ai-werewolf-arena/game-contract";
import type {
  PlayerNightAbilityStates,
  PlayerNightAbility,
} from "@ai-werewolf-arena/game-contract/night-ability-views";
import type { EventPayloadMap } from "../../core/domain/model";
import {
  abilityStatus,
  nightAbilityDisabled,
  projectPairState,
  type NightAbilityReadView,
} from "../mechanisms/roles/abilities";
import { projectShelterState } from "../mechanisms/roles/radiant_eclipse/shelter-state";
import {
  projectDreamerState,
  projectGuardState,
  projectRoleInspectionState,
  projectSeerState,
  projectWitchState,
} from "../mechanisms/roles/player_state";

export function projectAbilitySource(
  origin: EventPayloadMap["ability_changed"]["source"],
  disclosed: boolean,
): EventPayloadMap["ability_changed"]["source"] | { kind: AbilitySource["kind"] } {
  return !disclosed
    ? { kind: origin.kind }
    : origin.kind === "native"
      ? { kind: origin.kind, role: origin.role }
      : origin.kind === "gift"
        ? { kind: origin.kind, actorId: origin.actorId }
        : { kind: origin.kind, actorId: origin.actorId, abilityId: origin.abilityId };
}

export function projectNightState(
  ability: NightAbilityReadView,
): PlayerNightAbilityStates[NightAbilityKind] {
  switch (ability.kind) {
    case "pair_check":
      return projectPairState(ability.state);
    case "shelter":
      return projectShelterState(ability.state);
    case "seer_check":
      return projectSeerState(ability.state);
    case "potion":
      return projectWitchState(ability.state);
    case "role_check":
      return projectRoleInspectionState(ability.state);
    case "guard":
      return projectGuardState(ability.state);
    case "dream":
      return projectDreamerState(ability.state);
  }
}

export function projectNightAbility(
  ability: NightAbilityReadView,
  day: number,
): PlayerNightAbility {
  // 原 metadata 先逐字段形成；disabled 与 status 各自重读，不把这些查询合并成许可快照。
  const metadata = {
    id: ability.id,
    source: projectAbilitySource(ability.source, ability.sourceDisclosed),
    startsOnDay: ability.startsOnDay,
    ...(ability.expiresAfterDay === undefined ? {} : { expiresAfterDay: ability.expiresAfterDay }),
    maxUses: ability.maxUses,
    uses: ability.uses,
    lastUsedDay: ability.lastUsedDay,
    disabled: nightAbilityDisabled(ability),
    ...(ability.activation === undefined ? {} : { activation: ability.activation }),
    ...(ability.deathExpired === undefined ? {} : { deathExpired: ability.deathExpired }),
    status: abilityStatus(ability, day),
  };
  switch (ability.kind) {
    case "pair_check":
      return { ...metadata, kind: "pair_check", state: projectPairState(ability.state) };
    case "shelter":
      return { ...metadata, kind: "shelter", state: projectShelterState(ability.state) };
    case "seer_check":
      return { ...metadata, kind: "seer_check", state: projectSeerState(ability.state) };
    case "potion":
      return { ...metadata, kind: "potion", state: projectWitchState(ability.state) };
    case "role_check":
      return { ...metadata, kind: "role_check", state: projectRoleInspectionState(ability.state) };
    case "guard":
      return { ...metadata, kind: "guard", state: projectGuardState(ability.state) };
    case "dream":
      return { ...metadata, kind: "dream", state: projectDreamerState(ability.state) };
  }
}
