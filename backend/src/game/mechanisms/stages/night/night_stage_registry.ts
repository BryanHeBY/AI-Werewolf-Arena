/** 文件说明：根据板子角色集合构建夜间阶段列表。 */
import { BoardConfig, Role } from "../../../../core/domain/model";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "../../roles/profile_registry";
import { NightStageHandler } from "./contracts";

/** 夜间阶段注册表。 */
export class NightStageRegistry {
  private readonly roleProfileRegistry: RoleProfileRegistry;

  constructor(roleProfileRegistry: RoleProfileRegistry = getDefaultRoleProfileRegistry()) {
    this.roleProfileRegistry = roleProfileRegistry;
  }

  getStages(config: BoardConfig): NightStageHandler[] {
    const roleSet = new Set<Role>(config.roleSetups.map((item) => item.role));
    const collected: NightStageHandler[] = [];
    for (const role of roleSet.values()) {
      const pack = this.roleProfileRegistry.get(role)?.nightStages ?? [];
      collected.push(...pack);
    }
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
