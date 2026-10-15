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
import { TargetHintContext, TargetHintRegistry, type TargetHintQueries } from "./contracts";
import type { World } from "../../domain/world";
import type { RoleCatalog } from "../../rulesets/roles/catalog";
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
      const ids = ctx.queries.nobleChoiceTargets();
      return ids.length
        ? text(
            ctx.queries.locale(),
            ctx.allowedTools.includes("protect_secret_body")
              ? "prompt.targets.self"
              : "prompt.targets.others",
            { ids: ids.join(", ") },
          )
        : text(ctx.queries.locale(), "prompt.targets.none");
    }
    if (ctx.allowedTools.includes("cast_shelter") || ctx.allowedTools.includes("swallow_skill")) {
      const ids = ctx.allowedTools.includes("cast_shelter")
        ? ctx.queries.shelterTargets()
        : ctx.queries.eclipseSwallowTargets();
      return ids.length
        ? text(ctx.queries.locale(), "prompt.targets.others", { ids: ids.join(", ") })
        : text(ctx.queries.locale(), "prompt.targets.none");
    }
    if (ctx.allowedTools.includes("modify_skill") || ctx.allowedTools.includes("bonus_action")) {
      const candidates = ctx.allowedTools.includes("modify_skill")
        ? ctx.modifierCandidates
        : ctx.modifierBonusCandidates;
      if (candidates === undefined) throw new Error("scholar_mentor_candidates_missing");
      const alive = new Set(ctx.queries.aliveIds()),
        ids = [...new Set(candidates)].filter((id) => alive.has(id)).sort((a, b) => a - b);
      return ids.length
        ? text(
            ctx.queries.locale(),
            ids.includes(ctx.actorId) ? "prompt.targets.self" : "prompt.targets.others",
            { ids: ids.join(", ") },
          )
        : text(ctx.queries.locale(), "prompt.targets.none");
    }
    if (ctx.allowedTools.includes("challenge") && ctx.debateTargetId !== undefined)
      return text(ctx.queries.locale(), "prompt.targets.debate", { target: ctx.debateTargetId });
    if (ctx.allowedTools.includes("choose_lovers"))
      return text(ctx.queries.locale(), "prompt.targets.lovers", {
        ids: ctx.queries.aliveIds().join(", "),
      });
    const targetTools = ctx.allowedTools.filter((tool) => this.getRule(ctx.actorRole, tool));
    if (targetTools.length === 0) {
      return undefined;
    }
    const radiantSelf =
      ctx.queries.isRadiantBoard() &&
      (ctx.allowedTools.includes("use_potion") ||
        ctx.allowedTools.includes("check_identity") ||
        ctx.allowedTools.includes("kill_vote"));
    const allowSelf =
      radiantSelf || targetTools.some((tool) => this.getRule(ctx.actorRole, tool)?.allowSelf);
    const inspection = ctx.queries.inspection();
    const actorRules = ctx.queries.actorRules();
    const ids = ctx.queries
      .aliveIds()
      .filter((id) =>
        targetTools.some(
          (tool) =>
            (radiantSelf || this.getRule(ctx.actorRole, tool)?.allowSelf || id !== ctx.actorId) &&
            actorRules.luckyAllowed(tool, id) &&
            (tool !== "fear" || ctx.queries.fearTargets().includes(id)) &&
            (tool !== "swap_targets" || ctx.queries.swapTargets().includes(id)) &&
            (tool !== "kill_vote" || ctx.queries.wolfKnifeAllows(id)) &&
            (tool !== "inspect_night_identity" ||
              ctx.actorRole !== Role.WolfWitch ||
              ctx.queries.wolfWitchTargetAllowed(id)) &&
            (tool !== "awakened_guard" || actorRules.awakenedGuardAllowed(id)) &&
            (tool !== "vote" ||
              ((ctx.exileCandidates === undefined || ctx.exileCandidates.includes(id)) &&
                ctx.queries.canBeExiled(id) &&
                ctx.queries.loversVoteAllowed(id))) &&
            (tool !== "inspect_role" || !inspection || inspection.allows(id)) &&
            (tool !== "choose_badge_successor" ||
              (ctx.badgeCandidates?.includes(id) && ctx.queries.canBeSheriff(id))) &&
            (tool !== "vote_for_sheriff" ||
              (ctx.sheriffCandidates?.includes(id) && ctx.queries.canBeSheriff(id))),
        ),
      )
      .sort((a, b) => a - b);
    const potion = actorRules.potion();
    if (targetTools.length === 1 && targetTools[0] === "use_potion" && potion?.isLucky()) {
      return text(ctx.queries.locale(), "prompt.targets.lucky_poison", {
        ids: ids.join(", ") || text(ctx.queries.locale(), "common.none"),
        actor: ctx.actorId,
      });
    }
    if (ids.length === 0) {
      return text(ctx.queries.locale(), "prompt.targets.none");
    }
    if (allowSelf) {
      return text(ctx.queries.locale(), "prompt.targets.self", { ids: ids.join(", ") });
    }
    return text(ctx.queries.locale(), "prompt.targets.others", { ids: ids.join(", ") });
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

/** 可信提示装配输入；只在调用端绑定，不交给可替换 TargetHintRegistry。 */
export type TargetHintRuntimeInput = Omit<TargetHintContext, "queries"> & {
  world: World;
  roleCatalog?: RoleCatalog;
};

/**
 * 每次提示建立实际窄对象。数据字段保持晚读，组件和能力原引用只留在具体查询闭包里。
 * 这里不快照或复制资源，不发许可；查询异常仍由原提示调用路径传播。
 */
export function bindTargetHintContext(source: TargetHintRuntimeInput): TargetHintContext {
  const queries: TargetHintQueries = {
    locale: () => source.world.locale,
    aliveIds: () => [...source.world.getAliveEntityIds()],
    nobleChoiceTargets: () =>
      nobleBodyChoiceTargets(
        source.world,
        source.day ?? 1,
        source.allowedTools.includes("choose_servant") ? "noble" : "body",
      ),
    shelterTargets: () =>
      shelterTargets(source.world, source.day ?? 1, source.actorId, source.abilityId!),
    eclipseSwallowTargets: () => eclipseSwallowTargets(source.world, source.day ?? 1),
    isRadiantBoard: () => isRadiantEclipseBoard(source.world),
    inspection() {
      const inspection = getRoleInspectionState(
        source.world.getComponent(source.actorId, COMPONENT.Role)!,
        source.abilityId,
      );
      return inspection
        ? {
            allows: (id) =>
              inspectionRepeats(inspection) ||
              !inspection.history.some((report) => report.targetId === id),
          }
        : undefined;
    },
    actorRules() {
      const ownRole = source.world.getComponent(source.actorId, COMPONENT.Role);
      const awakenedGuard = getAwakenedState(ownRole)?.learned?.skill;
      return {
        luckyAllowed(tool, id) {
          const kind =
            tool === "check_identity"
              ? "seer_check"
              : tool === "guard"
                ? "guard"
                : tool === "use_potion"
                  ? "potion"
                  : null;
          if (!kind) return true;
          const ability = findNightAbility(ownRole, kind, source.abilityId);
          if (!ability) return true;
          // 普通女巫仍可救这个目标，即使其毒药目标因该行动者的历史记录而被限制。
          if (
            ability.kind === "potion" &&
            ability.activation !== "lucky" &&
            ability.activation !== "black_market" &&
            ability.state.heal > 0
          )
            return true;
          if (
            ability.kind === "seer_check" &&
            !seerTargetAllowed(ability.state, source.actorId, id)
          )
            return false;
          if (ability.kind === "guard" && guardTargetRepeated(ability, source.day ?? 1, id))
            return false;
          return luckyTargetAllowed(
            source.world,
            source.actorId,
            ability,
            source.day ?? 1,
            kind === "seer_check" ? "check" : kind === "guard" ? "guard" : "poison",
            id,
          );
        },

        awakenedGuardAllowed: (id) =>
          awakenedGuard?.kind !== "guard" ||
          awakenedGuard.lastGuardDay !== (source.day ?? 1) - 1 ||
          awakenedGuard.lastTarget !== id,
        potion() {
          // 定位仍先于外层工具分支，activation 仅在原幸运毒提示分支读取。
          const potion = findNightAbility(ownRole, "potion", source.abilityId);
          return potion ? { isLucky: () => potion.activation === "lucky" } : undefined;
        },
      };
    },
    fearTargets: () => nightmareFearTargets(source.world, source.actorId, source.day ?? 1),
    swapTargets: () => magicianChoiceTargets(source.world, source.day ?? 1),
    wolfKnifeAllows: (id) => bindWolfKnifeTargetQuery(source.world).allows(id),
    wolfWitchTargetAllowed: (id) =>
      (source.world.getComponent(id, COMPONENT.Role) &&
        source.world.getComponent(id, COMPONENT.Camp)?.camp) !== "wolf",
    canBeExiled: (id) => canBeExiled(source.world, id, source.roleCatalog),
    loversVoteAllowed: (id) => !prohibitsLoversVote(source.world, source.actorId, id),
    canBeSheriff: (id) => canBeSheriff(source.world, id, source.roleCatalog),
  };
  return {
    get modifierCandidates() {
      return source.modifierCandidates;
    },
    get modifierBonusCandidates() {
      return source.modifierBonusCandidates;
    },
    get actorId() {
      return source.actorId;
    },
    get day() {
      return source.day;
    },
    get actorRole() {
      return source.actorRole;
    },
    get abilityId() {
      return source.abilityId;
    },
    get debateTargetId() {
      return source.debateTargetId;
    },
    get allowedTools() {
      return source.allowedTools;
    },
    get sheriffCandidates() {
      return source.sheriffCandidates;
    },
    get badgeCandidates() {
      return source.badgeCandidates;
    },
    get exileCandidates() {
      return source.exileCandidates;
    },
    queries,
  };
}
