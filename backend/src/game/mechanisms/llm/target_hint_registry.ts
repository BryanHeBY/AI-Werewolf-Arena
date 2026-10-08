import { text } from "@ai-werewolf-arena/game-text";
/** 文件说明：按工具与角色策略生成 target_id 可行动编号提示。 */
import { Role, ToolName } from "../../../core/domain/model";
import { TargetHintContext, TargetHintRegistry } from "./contracts";
import { canBeExiled, canBeSheriff } from "../common/participation";

interface TargetRule {
  allowSelf: boolean;
}

/**
 * 默认 target_id 提示注册器：
 * - 以工具规则为基线；
 * - 再按角色规则覆盖，便于角色机制独立扩展。
 */
export class DefaultTargetHintRegistry implements TargetHintRegistry {
  private readonly toolRules: Partial<Record<ToolName, TargetRule>> = {
    kill_vote: { allowSelf: false },
    guard: { allowSelf: false },
    check_identity: { allowSelf: false },
    use_potion: { allowSelf: false },
    vote: { allowSelf: false },
    shoot: { allowSelf: false },
    vote_for_sheriff: { allowSelf: false },
  };

  private readonly roleOverrides: Partial<
    Record<Role, Partial<Record<ToolName, TargetRule>>>
  > = {
    [Role.Wolf]: {
      // 狼人策略中可允许自刀，提示层保留自己编号避免“无效 self target”误判。
      kill_vote: { allowSelf: true },
    },
    [Role.Witch]: {
      // 女巫可自救，提示层需包含自己。
      use_potion: { allowSelf: true },
    },
    [Role.Guard]: {
      // 守卫是否可自守由板子机制决定；提示层默认放开，避免误导模型。
      guard: { allowSelf: true },
    },
  };

  buildActionableIdsHint(ctx: TargetHintContext): string | undefined {
    const targetTools = ctx.allowedTools.filter((tool) => this.getRule(ctx.actorRole, tool));
    if (targetTools.length === 0) {
      return undefined;
    }
    const allowSelf = targetTools.some((tool) => this.getRule(ctx.actorRole, tool)?.allowSelf);
    const ids = ctx.world
      .getAliveEntityIds()
      .filter(id => targetTools.some(tool => (this.getRule(ctx.actorRole, tool)?.allowSelf || id !== ctx.actorId) &&
        (tool !== "vote" || canBeExiled(ctx.world, id, ctx.roleCatalog)) &&
        (tool !== "vote_for_sheriff" || ctx.sheriffCandidates?.includes(id) && canBeSheriff(ctx.world, id, ctx.roleCatalog))))
      .sort((a, b) => a - b);
    if (ids.length === 0) {
      return text(ctx.world.locale, "prompt.targets.none");
    }
    if (allowSelf) {
      return text(ctx.world.locale, "prompt.targets.self", { ids: ids.join(", ") });
    }
    return text(ctx.world.locale, "prompt.targets.others", { ids: ids.join(", ") });
  }

  private getRule(
    role: Role | undefined,
    tool: ToolName,
  ): TargetRule | undefined {
    const roleRule =
      role !== undefined ? this.roleOverrides[role]?.[tool] : undefined;
    return roleRule ?? this.toolRules[tool];
  }
}

let defaultTargetHintRegistry: TargetHintRegistry | null = null;

/** 获取默认 target_id 提示注册器。 */
export function getDefaultTargetHintRegistry(): TargetHintRegistry {
  if (!defaultTargetHintRegistry) {
    defaultTargetHintRegistry = new DefaultTargetHintRegistry();
  }
  return defaultTargetHintRegistry;
}
