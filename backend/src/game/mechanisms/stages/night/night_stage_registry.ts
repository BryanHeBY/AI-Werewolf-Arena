/** 文件说明：根据板子角色集合构建夜间阶段列表。 */
import { BoardConfig, Role } from "../../../../core/domain/model";
import { RoleCatalog, getDefaultRoleCatalog } from "../../roles/catalog";
import { NightStageHandler } from "./contracts";
import type { World } from "../../../../core/domain/world";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { allNightAbilities, type NightAbilityKind } from "../../roles/abilities";

import {PSYCHIC_INSPECTION_STAGE} from "../../roles/role_inspection/night_stages";
import { LUCKY_ABILITY_STAGE } from "../../roles/miracle_merchant/lucky_stage";

const abilityRole: Record<NightAbilityKind, Role> = { seer_check: Role.Seer,role_check:Role.Gargoyle, guard: Role.Guard, potion: Role.Witch, dream: Role.Dreamer };

/** 夜间阶段注册表。 */
export class NightStageRegistry {
  readonly roleCatalog: RoleCatalog;

  constructor(roleProfileRegistry: RoleCatalog = getDefaultRoleCatalog()) {
    this.roleCatalog = roleProfileRegistry;
  }

  getStages(config: BoardConfig, world?: World): NightStageHandler[] {
    const roleSet = new Set<Role>(config.roleSetups.map((item) => item.role));
    for (const role of [...roleSet]) for (const kind of this.roleCatalog.get(role)?.possibleNightAbilities ?? []) roleSet.add(abilityRole[kind]);
    for (const id of world?.entityIds() ?? []) for (const ability of allNightAbilities(world!.getComponent<RoleComponent>(id, COMPONENT.Role))) roleSet.add(abilityRole[ability.kind]);
    const collected: NightStageHandler[] = [];
    for (const role of roleSet.values()) {
      const pack = this.roleCatalog.get(role)?.nightStages ?? [];
      collected.push(...pack);
    }
    if(collected.some(stage=>stage.id==="role_inspection"))collected.push(PSYCHIC_INSPECTION_STAGE);
    if (world?.entityIds().some(id => allNightAbilities(world.getComponent<RoleComponent>(id, COMPONENT.Role)).some(ability => ability.activation === "lucky"))) collected.push(LUCKY_ABILITY_STAGE);
    // 去重并按显式优先级排序（priority 越小越先执行）。
    const dedup = new Map<string, NightStageHandler>();
    for (const stage of collected) {
      if (!dedup.has(stage.id)) {
        dedup.set(stage.id, stage);
      }
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
