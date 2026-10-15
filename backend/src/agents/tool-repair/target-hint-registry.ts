/**
 * 根据请求、角色和已注册目标规则生成可行动编号提示。输入为当前组件状态与候选上下文，
 * 输出为本地化提示；提示不授予行动权限，实际校验与提交仍由网关和具体机制负责。
 * 狼刀候选只消费公开目标查询，不取得狼人私有状态或狼刀提交权。
 */
import { nobleBodyChoiceTargets } from "../../features/noble-secret-body/authority";
import {
  shelterTargets,
  eclipseSwallowTargets,
  isRadiantEclipseBoard,
} from "../../features/radiant-eclipse/night-frame";
import { nightmareFearTargets } from "../../features/nightmare/ports";
import { magicianChoiceTargets } from "../../features/magician/night-frame";
import { bindWolfKnifeTargetQuery } from "../../features/wolf/ports";
import { prohibitsLoversVote } from "../../features/cupid/relation";
import { seerTargetAllowed } from "../../features/seer/ports";
import { guardTargetRepeated } from "../../features/guard/ports";
import { text } from "@ai-werewolf-arena/game-text";
import { Role, ToolName } from "../../domain/model";
import { TargetHintContext, TargetHintRegistry } from "./contracts";
import { canBeExiled, canBeSheriff } from "../../engine/participation";
import { inspectionRepeats } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import { getRoleInspectionState } from "../../features/role-inspection/ports";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { findNightAbility } from "../../features/night-abilities/abilities";
import { luckyTargetAllowed } from "../../features/night-abilities/night-action-history";
import { getAwakenedState } from "../../features/awakened-hidden-wolf/state";

interface TargetRule {
  /** 只决定提示是否保留自身编号；当前板子的实际目标限制仍由机制复验。 */
  allowSelf: boolean;
}

/**
 * 默认 target_id 提示注册器：
 * - 以工具规则为基线；
 * - 再按角色规则覆盖，便于角色机制独立扩展。
 */
export class DefaultTargetHintRegistry implements TargetHintRegistry {
  private readonly toolRules: Partial<Record<ToolName, TargetRule>> = {
    fox_distract: { allowSelf: true },
    bind_fragrant_pair: { allowSelf: true },
    check_pair: { allowSelf: true },
    choose_servant: { allowSelf: false },
    protect_secret_body: { allowSelf: true },
    kill_vote: { allowSelf: false },
    fear: { allowSelf: false },
    swap_targets: { allowSelf: true },
    guard: { allowSelf: false },
    check_identity: { allowSelf: false },
    inspect_role: { allowSelf: false },
    inspect_night_identity: { allowSelf: false },
    mimic_role: { allowSelf: false },
    mechanical_inspect: { allowSelf: false },
    awakened_mimic: { allowSelf: false },
    awakened_poison: { allowSelf: true },
    awakened_guard: { allowSelf: true },
    awakened_attack: { allowSelf: true },
    bestow_ability: { allowSelf: false },
    choose_exemplar: { allowSelf: false },
    mechanical_poison: { allowSelf: true },
    mechanical_guard: { allowSelf: true },
    mechanical_attack: { allowSelf: true },
    use_potion: { allowSelf: false },
    vote: { allowSelf: false },
    shoot: { allowSelf: false },
    black_market_trade: { allowSelf: false },
    self_destruct_with_target: { allowSelf: false },
    duel: { allowSelf: false },
    dream: { allowSelf: false },
    charm: { allowSelf: false },
    vote_for_sheriff: { allowSelf: false },
    choose_badge_successor: { allowSelf: false },
  };

  private readonly roleOverrides: Partial<Record<Role, Partial<Record<ToolName, TargetRule>>>> = {
    [Role.FragrantPhantom]: { kill_vote: { allowSelf: true } },
    [Role.NightNoble]: { kill_vote: { allowSelf: true } },
    [Role.Wolf]: {
      // 狼人策略中可允许自刀，提示层保留自己编号避免“无效 self target”误判。
      kill_vote: { allowSelf: true },
    },
    [Role.WolfKing]: { kill_vote: { allowSelf: true } },
    [Role.NightmareShadow]: { kill_vote: { allowSelf: true } },
    [Role.WolfWitch]: { kill_vote: { allowSelf: true } },
    [Role.WhiteWolfKing]: { kill_vote: { allowSelf: true } },
    [Role.HiddenWolf]: { kill_vote: { allowSelf: true } },
    [Role.Gargoyle]: { kill_vote: { allowSelf: true } },
    [Role.MechanicalWolf]: { kill_vote: { allowSelf: true } },
    [Role.AwakenedHiddenWolf]: { kill_vote: { allowSelf: true } },
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
    if (
      ctx.allowedTools.includes("choose_servant") ||
      ctx.allowedTools.includes("protect_secret_body")
    ) {
      const ids = nobleBodyChoiceTargets(
        ctx.world,
        ctx.day ?? 1,
        ctx.allowedTools.includes("choose_servant") ? "noble" : "body",
      );
      return ids.length
        ? text(
            ctx.world.locale,
            ctx.allowedTools.includes("protect_secret_body")
              ? "prompt.targets.self"
              : "prompt.targets.others",
            { ids: ids.join(", ") },
          )
        : text(ctx.world.locale, "prompt.targets.none");
    }
    if (ctx.allowedTools.includes("cast_shelter") || ctx.allowedTools.includes("swallow_skill")) {
      const ids = ctx.allowedTools.includes("cast_shelter")
        ? shelterTargets(ctx.world, ctx.day ?? 1, ctx.actorId, ctx.abilityId!)
        : eclipseSwallowTargets(ctx.world, ctx.day ?? 1);
      return ids.length
        ? text(ctx.world.locale, "prompt.targets.others", { ids: ids.join(", ") })
        : text(ctx.world.locale, "prompt.targets.none");
    }
    if (ctx.allowedTools.includes("modify_skill") || ctx.allowedTools.includes("bonus_action")) {
      const candidates = ctx.allowedTools.includes("modify_skill")
        ? ctx.modifierCandidates
        : ctx.modifierBonusCandidates;
      if (candidates === undefined) throw new Error("scholar_mentor_candidates_missing");
      const alive = new Set(ctx.world.getAliveEntityIds()),
        ids = [...new Set(candidates)].filter((id) => alive.has(id)).sort((a, b) => a - b);
      return ids.length
        ? text(
            ctx.world.locale,
            ids.includes(ctx.actorId) ? "prompt.targets.self" : "prompt.targets.others",
            { ids: ids.join(", ") },
          )
        : text(ctx.world.locale, "prompt.targets.none");
    }
    if (ctx.allowedTools.includes("challenge") && ctx.debateTargetId !== undefined)
      return text(ctx.world.locale, "prompt.targets.debate", { target: ctx.debateTargetId });
    if (ctx.allowedTools.includes("choose_lovers"))
      return text(ctx.world.locale, "prompt.targets.lovers", {
        ids: ctx.world.getAliveEntityIds().join(", "),
      });
    const targetTools = ctx.allowedTools.filter((tool) => this.getRule(ctx.actorRole, tool));
    if (targetTools.length === 0) {
      return undefined;
    }
    const radiantSelf =
      isRadiantEclipseBoard(ctx.world) &&
      (ctx.allowedTools.includes("use_potion") ||
        ctx.allowedTools.includes("check_identity") ||
        ctx.allowedTools.includes("kill_vote"));
    const allowSelf =
      radiantSelf || targetTools.some((tool) => this.getRule(ctx.actorRole, tool)?.allowSelf);
    const inspection = getRoleInspectionState(
      ctx.world.getComponent(ctx.actorId, COMPONENT.Role)!,
      ctx.abilityId,
    );
    const ownRole = ctx.world.getComponent(ctx.actorId, COMPONENT.Role);
    const awakenedGuard = getAwakenedState(ownRole)?.learned?.skill;
    const luckyAllowed = (tool: ToolName, id: number) => {
      const kind =
        tool === "check_identity"
          ? "seer_check"
          : tool === "guard"
            ? "guard"
            : tool === "use_potion"
              ? "potion"
              : null;
      if (!kind) return true;
      const ability = findNightAbility(ownRole, kind, ctx.abilityId);
      if (!ability) return true;
      // 普通女巫仍可救这个目标，即使其毒药目标因该行动者的历史记录而被限制。
      if (
        ability.kind === "potion" &&
        ability.activation !== "lucky" &&
        ability.activation !== "black_market" &&
        ability.state.heal > 0
      )
        return true;
      if (ability.kind === "seer_check" && !seerTargetAllowed(ability.state, ctx.actorId, id))
        return false;
      if (ability.kind === "guard" && guardTargetRepeated(ability, ctx.day ?? 1, id)) return false;
      return luckyTargetAllowed(
        ctx.world,
        ctx.actorId,
        ability,
        ctx.day ?? 1,
        kind === "seer_check" ? "check" : kind === "guard" ? "guard" : "poison",
        id,
      );
    };
    const ids = ctx.world
      .getAliveEntityIds()
      .filter((id) =>
        targetTools.some(
          (tool) =>
            (radiantSelf || this.getRule(ctx.actorRole, tool)?.allowSelf || id !== ctx.actorId) &&
            luckyAllowed(tool, id) &&
            (tool !== "fear" ||
              nightmareFearTargets(ctx.world, ctx.actorId, ctx.day ?? 1).includes(id)) &&
            (tool !== "swap_targets" ||
              magicianChoiceTargets(ctx.world, ctx.day ?? 1).includes(id)) &&
            (tool !== "kill_vote" || bindWolfKnifeTargetQuery(ctx.world).allows(id)) &&
            (tool !== "inspect_night_identity" ||
              ctx.actorRole !== Role.WolfWitch ||
              (ctx.world.getComponent(id, COMPONENT.Role) &&
                ctx.world.getComponent(id, COMPONENT.Camp)?.camp) !== "wolf") &&
            (tool !== "awakened_guard" ||
              awakenedGuard?.kind !== "guard" ||
              awakenedGuard.lastGuardDay !== (ctx.day ?? 1) - 1 ||
              awakenedGuard.lastTarget !== id) &&
            (tool !== "vote" ||
              ((ctx.exileCandidates === undefined || ctx.exileCandidates.includes(id)) &&
                canBeExiled(ctx.world, id, ctx.roleCatalog) &&
                !prohibitsLoversVote(ctx.world, ctx.actorId, id))) &&
            (tool !== "inspect_role" ||
              !inspection ||
              inspectionRepeats(inspection) ||
              !inspection.history.some((report) => report.targetId === id)) &&
            (tool !== "choose_badge_successor" ||
              (ctx.badgeCandidates?.includes(id) &&
                canBeSheriff(ctx.world, id, ctx.roleCatalog))) &&
            (tool !== "vote_for_sheriff" ||
              (ctx.sheriffCandidates?.includes(id) &&
                canBeSheriff(ctx.world, id, ctx.roleCatalog))),
        ),
      )
      .sort((a, b) => a - b);
    const potion = findNightAbility(ownRole, "potion", ctx.abilityId);
    if (
      targetTools.length === 1 &&
      targetTools[0] === "use_potion" &&
      potion?.activation === "lucky"
    ) {
      return text(ctx.world.locale, "prompt.targets.lucky_poison", {
        ids: ids.join(", ") || text(ctx.world.locale, "common.none"),
        actor: ctx.actorId,
      });
    }
    if (ids.length === 0) {
      return text(ctx.world.locale, "prompt.targets.none");
    }
    if (allowSelf) {
      return text(ctx.world.locale, "prompt.targets.self", { ids: ids.join(", ") });
    }
    return text(ctx.world.locale, "prompt.targets.others", { ids: ids.join(", ") });
  }

  private getRule(role: Role | undefined, tool: ToolName): TargetRule | undefined {
    const roleRule = role !== undefined ? this.roleOverrides[role]?.[tool] : undefined;
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
