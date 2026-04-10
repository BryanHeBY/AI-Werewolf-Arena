import { BoardConfig, Role } from "../../../domain/model";
import { GUARD_NIGHT_STAGES } from "../../roles/guard/night_stages";
import { SEER_NIGHT_STAGES } from "../../roles/seer/night_stages";
import { WITCH_NIGHT_STAGES } from "../../roles/witch/night_stages";
import { WOLF_NIGHT_STAGES } from "../../roles/wolf/night_stages";
import { NightStageHandler } from "./contracts";

const NIGHT_STAGE_PACKS: Partial<Record<Role, NightStageHandler[]>> = {
  [Role.Wolf]: WOLF_NIGHT_STAGES,
  [Role.Guard]: GUARD_NIGHT_STAGES,
  [Role.Witch]: WITCH_NIGHT_STAGES,
  [Role.Seer]: SEER_NIGHT_STAGES,
};

export class NightStageRegistry {
  private readonly stagePacks: Partial<Record<Role, NightStageHandler[]>>;

  constructor(stagePacks: Partial<Record<Role, NightStageHandler[]>> = NIGHT_STAGE_PACKS) {
    this.stagePacks = { ...stagePacks };
  }

  getStages(config: BoardConfig): NightStageHandler[] {
    const roleSet = new Set<Role>(config.roleSetups.map((item) => item.role));
    const collected: NightStageHandler[] = [];
    for (const role of roleSet.values()) {
      const pack = this.stagePacks[role] ?? [];
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

export function getDefaultNightStageRegistry(): NightStageRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new NightStageRegistry();
  }
  return defaultRegistry;
}
