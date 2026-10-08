import { text } from "@ai-werewolf-arena/game-text";
/** 文件说明：按工具与角色策略生成 target_id 可行动编号提示。 */
import { Role, ToolName } from "../../../core/domain/model";
import { TargetHintContext, TargetHintRegistry } from "./contracts";
import { canBeExiled, canBeSheriff } from "../common/participation";
import {roleInspectionPolicy} from "../roles/abilities";
import {getRoleInspectionState} from "../roles/private_state";
import {COMPONENT} from "../../../core/domain/components/names";
import type {RoleComponent} from "../../../core/domain/components/role";
import { findNightAbility } from "../roles/abilities";
import { luckyTargetAllowed } from "../roles/night_action_history";

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
    inspect_role:{allowSelf:false},
    mimic_role: { allowSelf: false }, mechanical_inspect: { allowSelf: false },
    bestow_ability: { allowSelf: false },
    choose_exemplar: { allowSelf: false },
    mechanical_poison: { allowSelf: true }, mechanical_guard: { allowSelf: true }, mechanical_attack: { allowSelf: true },
    use_potion: { allowSelf: false },
    vote: { allowSelf: false },
    shoot: { allowSelf: false },
    self_destruct_with_target: { allowSelf: false },
    duel: { allowSelf: false },
    dream: { allowSelf: false },
    charm: { allowSelf: false },
    vote_for_sheriff: { allowSelf: false },
  };

  private readonly roleOverrides: Partial<
    Record<Role, Partial<Record<ToolName, TargetRule>>>
  > = {
    [Role.Wolf]: {
      // 狼人策略中可允许自刀，提示层保留自己编号避免“无效 self target”误判。
      kill_vote: { allowSelf: true },
    },
    [Role.WolfKing]: { kill_vote: { allowSelf: true } },
    [Role.WhiteWolfKing]: { kill_vote: { allowSelf: true } },
    [Role.HiddenWolf]: {kill_vote:{allowSelf:true}},
    [Role.Gargoyle]:{kill_vote:{allowSelf:true}},
    [Role.MechanicalWolf]: { kill_vote: { allowSelf: true } },
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
    const inspection=getRoleInspectionState(ctx.world.getComponent<RoleComponent>(ctx.actorId,COMPONENT.Role)!,ctx.abilityId);
    const ownRole = ctx.world.getComponent<RoleComponent>(ctx.actorId, COMPONENT.Role);
    const luckyAllowed = (tool: ToolName, id: number) => {
      const kind = tool === "check_identity" ? "seer_check" : tool === "guard" ? "guard" : tool === "use_potion" ? "potion" : null;
      if (!kind) return true;
      const ability = findNightAbility(ownRole, kind, ctx.abilityId);
      if (!ability) return true;
      // An ordinary Witch may still heal a target whose poison is blocked by this actor's history.
      if (ability.kind === "potion" && ability.activation !== "lucky" && ability.state.heal > 0) return true;
      return luckyTargetAllowed(ctx.world, ctx.actorId, ability, ctx.day ?? 1, kind === "seer_check" ? "check" : kind === "guard" ? "guard" : "poison", id);
    };
    const ids = ctx.world
      .getAliveEntityIds()
      .filter(id => targetTools.some(tool => (this.getRule(ctx.actorRole, tool)?.allowSelf || id !== ctx.actorId) &&
        luckyAllowed(tool, id) &&
        (tool !== "vote" || canBeExiled(ctx.world, id, ctx.roleCatalog)) &&
        (tool!=="inspect_role"||!inspection||roleInspectionPolicy(inspection)==="psychic"||!inspection.history.some(report=>report.targetId===id))&&
        (tool !== "vote_for_sheriff" || ctx.sheriffCandidates?.includes(id) && canBeSheriff(ctx.world, id, ctx.roleCatalog))))
      .sort((a, b) => a - b);
    const potion = findNightAbility(ownRole, "potion", ctx.abilityId);
    if (targetTools.length === 1 && targetTools[0] === "use_potion" && potion?.activation === "lucky") {
      return text(ctx.world.locale, "prompt.targets.lucky_poison", { ids: ids.join(", ") || text(ctx.world.locale, "common.none"), actor: ctx.actorId });
    }
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
