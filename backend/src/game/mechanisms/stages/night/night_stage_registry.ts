/**
 * Collects, deduplicates and orders registered night stages for present and declared abilities.
 * Inputs are catalog profiles, current roles and possible ability roles; output is the assembled
 * stage list. It does not freeze which player will act or instantiate an ability resource.
 */
import { demonHunterActorId } from "../../roles/demon_hunter/authority";
import { DEMON_HUNTER_NIGHT_STAGE } from "../../roles/demon_hunter/night_stages";
import { WEDDING_CHAT_STAGE, WEDDING_KNIFE_STAGE } from "../../roles/ghost_bride/night_stages";
/** 文件说明：根据板子角色集合构建夜间阶段列表。 */
import { BoardConfig, Role } from "../../../../core/domain/model";
import { RoleCatalog, getDefaultRoleCatalog } from "../../roles/catalog";
import { NightStageHandler } from "./contracts";
import type { World } from "../../../../core/domain/world";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { allNightAbilities, type NightAbilityKind } from "../../roles/abilities";

import {
  ROLE_INSPECTION_STAGE,
  PSYCHIC_INSPECTION_STAGE,
  MIRROR_INSPECTION_STAGE,
} from "../../roles/role_inspection/night_stages";
import { BLACK_MARKET_RECIPIENT_STAGE } from "../../roles/black_market_merchant/night_stage";
import { LUCKY_ABILITY_STAGE } from "../../roles/miracle_merchant/lucky_stage";
import { allDeathGuns } from "../../roles/death_abilities";
import { DEATH_ABILITY_ACTIVATION_STAGE } from "../../roles/death_ability_activation";

const abilityRole: Record<NightAbilityKind, Role> = {
  pair_check: Role.AwakenedSeer,
  shelter: Role.RadiantCount,
  seer_check: Role.Seer,
  role_check: Role.Gargoyle,
  guard: Role.Guard,
  potion: Role.Witch,
  dream: Role.Dreamer,
};

/** 夜间阶段注册表。 */
export class NightStageRegistry {
  readonly roleCatalog: RoleCatalog;

  constructor(roleProfileRegistry: RoleCatalog = getDefaultRoleCatalog()) {
    this.roleCatalog = roleProfileRegistry;
  }

  getStages(config: BoardConfig, world?: World): NightStageHandler[] {
    const roleSet = new Set<Role>(config.roleSetups.map((item) => item.role));
    let hasRoleChecks = false;
    for (const role of [...roleSet])
      for (const kind of this.roleCatalog.get(role)?.possibleNightAbilities ?? []) {
        roleSet.add(abilityRole[kind]);
        if (kind === "role_check") hasRoleChecks = true;
      }
    for (const id of world?.entityIds() ?? [])
      for (const ability of allNightAbilities(world!.getComponent(id, COMPONENT.Role))) {
        roleSet.add(abilityRole[ability.kind]);
        if (ability.kind === "role_check") hasRoleChecks = true;
      }
    const collected: NightStageHandler[] = [];
    if (world && demonHunterActorId(world) !== null) collected.push(DEMON_HUNTER_NIGHT_STAGE);
    if (
      [...roleSet].some((role) =>
        this.roleCatalog.get(role)?.possibleDeathAbilities?.includes("gun"),
      ) ||
      world
        ?.getAliveEntityIds()
        .some((id) =>
          allDeathGuns(world.getComponent(id, COMPONENT.Role)).some(
            (gun) => gun.armedOnNight === null && !gun.disabled && !gun.deathExpired,
          ),
        )
    )
      collected.push(DEATH_ABILITY_ACTIVATION_STAGE);
    for (const role of roleSet.values()) {
      const pack = this.roleCatalog.get(role)?.nightStages ?? [];
      collected.push(...pack);
    }
    if (hasRoleChecks || collected.some((stage) => stage.id === "role_inspection"))
      collected.push(ROLE_INSPECTION_STAGE, PSYCHIC_INSPECTION_STAGE, MIRROR_INSPECTION_STAGE);
    if (
      world
        ?.entityIds()
        .some((id) =>
          allNightAbilities(world.getComponent(id, COMPONENT.Role)).some(
            (ability) => ability.activation === "lucky",
          ),
        )
    )
      collected.push(LUCKY_ABILITY_STAGE);
    if (
      world
        ?.entityIds()
        .some((id) =>
          allNightAbilities(world.getComponent(id, COMPONENT.Role)).some(
            (ability) => ability.activation === "black_market",
          ),
        )
    )
      collected.push(BLACK_MARKET_RECIPIENT_STAGE);
    // 去重并按显式优先级排序（priority 越小越先执行）。
    const dedup = new Map<string, NightStageHandler>();
    for (const stage of collected) {
      if (!dedup.has(stage.id)) {
        dedup.set(stage.id, stage);
      }
    }
    if (roleSet.has(Role.GhostBride)) {
      dedup.delete("wolf_kill_vote");
      dedup.set(WEDDING_CHAT_STAGE.id, WEDDING_CHAT_STAGE);
      dedup.set(WEDDING_KNIFE_STAGE.id, WEDDING_KNIFE_STAGE);
      const chat = dedup.get("wolf_discussion");
      if (chat) dedup.set(chat.id, { ...chat, priority: 350 });
    }
    return Array.from(dedup.values()).sort((a, b) => {
      const diff = a.priority - b.priority;
      if (diff !== 0) {
        return diff;
      }
      return a.id.localeCompare(b.id);
    });
  }
}

let defaultRegistry: NightStageRegistry | null = null;

/** 获取默认夜间阶段注册表实例。 */
export function getDefaultNightStageRegistry(): NightStageRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new NightStageRegistry();
  }
  return defaultRegistry;
}
