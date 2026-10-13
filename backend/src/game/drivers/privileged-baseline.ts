/**
 * 负责 mock、smoke 与规则测试的特权基线决策。输入为原 World、请求和角色目录，
 * 输出为按既定席位与角色策略选出的工具动作；可读取真实阵营，不作为玩家受限观察或生产模型回退。
 * 本模块拥有启发式选择，行动许可、付款、事实发布和最终规则结算仍由引擎及具体机制重检。
 * 无模型、网络或独立随机源；候选按原查询时点读取，异常保留已完成的读取与脚本前缀。
 */
import { roleInspectionPolicy } from "../mechanisms/roles/role_inspection/ports";
import { scholarMentorBonusTargets } from "../mechanisms/roles/scholar_mentor/night_frame";
import { prohibitsLoversVote } from "../mechanisms/roles/cupid/relation";
import { text } from "@ai-werewolf-arena/game-text";
import { COMPONENT } from "../../core/domain/components/names";
import { RoleComponent } from "../../core/domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  Camp,
  EntityId,
  Phase,
  Role,
  ToolCall,
} from "../../core/domain";
import { World } from "../../core/domain/world";
import { RoleCatalog, getDefaultRoleCatalog, wolfTeamPermissions, allNightAbilities, activeNightAbility, ROLE_INSPECTION_POLICY_ROLES } from "../mechanisms";
import { canBeExiled, canBeSheriff, canVote } from "../mechanisms/common/participation";

/**
 * 明确特权的基线机器人：仅供 mock、smoke 和规则测试驱动，不作为生产模型回退。
 */
export class BaselineBotActionProvider implements ActionProvider {
  private readonly roleCatalog: RoleCatalog;

  constructor(
    private readonly world: World,
    roleCatalog: RoleCatalog = getDefaultRoleCatalog(),
  ) {
    this.roleCatalog = roleCatalog;
  }

  /**
   * 根据阶段与角色生成默认动作。
   */
  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (request.allowedTools.includes("write_note"))
      return { name: "write_note", args: { text: "..." } };
    if (request.allowedTools.includes("debate_vote"))
      return { name: "debate_vote", args: { support: true } };
    const role = this.world.getComponent(request.actorId, COMPONENT.Role);
    if (!role) {
      return null;
    }

    if (request.allowedTools.includes("choose_badge_successor")) {
      const id = request.context.badge_candidates?.find((id) =>
        canBeSheriff(this.world, id, this.roleCatalog),
      );
      return { name: "choose_badge_successor", args: { target_id: id ?? null } };
    }
    if (request.allowedTools.includes("choose_direction")) {
      if (!canBeSheriff(this.world, request.actorId, this.roleCatalog)) return null;
      // 基线策略：偶数位顺时针，奇数位逆时针，保证可重复。
      return {
        name: "choose_direction",
        args: {
          direction: request.actorId % 2 === 0 ? "clockwise" : "counter_clockwise",
        },
      };
    }

    if (request.allowedTools.includes("run_for_sheriff")) {
      if (!canBeSheriff(this.world, request.actorId, this.roleCatalog)) return null;
      // 基线策略：存活玩家默认上警，避免“需至少一次行动”的回合无动作。
      return {
        name: "run_for_sheriff",
        args: { run: true },
      };
    }

    if (request.allowedTools.includes("vote_for_sheriff")) {
      if (
        !canVote(this.world, request.actorId, this.roleCatalog) ||
        request.context.sheriff_candidates?.includes(request.actorId)
      )
        return null;
      const rawCandidates = request.context.sheriff_candidates;
      const candidates = Array.isArray(rawCandidates)
        ? rawCandidates
            .map((item) => Number(item))
            .filter(
              (id) =>
                Number.isFinite(id) && id > 0 && canBeSheriff(this.world, id, this.roleCatalog),
            )
        : [];
      const preferred = candidates.find((id) => id !== request.actorId) ?? candidates[0];
      if (preferred !== undefined) {
        return {
          name: "vote_for_sheriff",
          args: { target_id: preferred, abstain: false },
        };
      }
      return {
        name: "vote_for_sheriff",
        args: { target_id: null, abstain: true },
      };
    }

    if (request.allowedTools.includes("speak")) {
      const isLastWords = request.context.trigger === "last_words";
      return {
        name: "speak",
        args: {
          text: text(this.world.locale, isLastWords ? "fallback.last_words" : "fallback.speech", {
            actor: request.actorId,
          }),
        },
      };
    }

    if (request.phase === Phase.Voting && request.allowedTools.includes("vote")) {
      if (
        !canVote(this.world, request.actorId, this.roleCatalog) ||
        request.context.exile_candidates?.includes(request.actorId)
      )
        return null;
      // 席位顺序提供确定的默认目标；角色资格与情侣禁票仍逐目标查询，不能据此绕过网关复验。
      const target =
        this.world
          .getAliveEntityIds()
          .find(
            (id) =>
              id !== request.actorId &&
              (request.context.exile_candidates === undefined ||
                request.context.exile_candidates.includes(id)) &&
              canBeExiled(this.world, id, this.roleCatalog) &&
              !prohibitsLoversVote(this.world, request.actorId, id),
          ) ?? null;
      return target !== null
        ? { name: "vote", args: { target_id: target, abstain: false } }
        : { name: "vote", args: { target_id: null, abstain: true } };
    }

    // 绑定动作使用原能力实例；没有实例、不是夜间或本夜未激活时不退回持有者原生技能。
    const bound = request.context.ability_id
      ? allNightAbilities(role).find((ability) => ability.id === request.context.ability_id)
      : undefined;
    if (
      request.context.ability_id &&
      (!bound ||
        request.phase !== Phase.Night ||
        !activeNightAbility(role, bound.kind, request.context.day, bound.id))
    )
      return null;
    const abilityRole =
      bound?.kind === "shelter"
        ? Role.RadiantCount
        : bound?.kind === "role_check"
          ? ROLE_INSPECTION_POLICY_ROLES[roleInspectionPolicy(bound.state)]
          : bound?.kind === "seer_check"
            ? Role.Seer
            : bound?.kind === "guard"
              ? Role.Guard
              : bound?.kind === "potion"
                ? Role.Witch
                : bound?.kind === "dream"
                  ? Role.Dreamer
                  : role.role;
    if (request.allowedTools.includes("bonus_action") && request.context.modifier_bonus_kind) {
      const kind = request.context.modifier_bonus_kind,
        target =
          scholarMentorBonusTargets(this.world, request.context.day, request.actorId, kind)[0] ??
          null;
      return { name: "bonus_action", args: { kind, target_id: target, abstain: target === null } };
    }
    // 角色基线钩子可使用真实 World。这是显式特权驱动，不能复用为玩家受限观察回退。
    const roleProfile = this.roleCatalog.runtime(abilityRole);
    if (roleProfile?.baselineAction) {
      const action = roleProfile.baselineAction(
        role,
        request,
        () => this.pickAliveNotSelf(request.actorId),
        (camp) => this.pickAliveByCamp(request.actorId, this.parseCamp(camp)),
        this.world.locale,
        this.world,
      );
      if (action?.name === "speak_to_wolves" || action?.name === "kill_vote") {
        // 钩子选择之后再按当前身份、生命和夜间权限检查；选择工具并不授予狼聊或刀权。
        const access = wolfTeamPermissions(role, this.roleCatalog, this.world);
        const permitted =
          action.name === "speak_to_wolves" ? access.canChat : access.canVoteForKill;
        if (
          !permitted ||
          request.phase !== Phase.Night ||
          !this.world.getAliveEntityIds().includes(request.actorId)
        )
          return null;
      }
      return action;
    }

    return null;
  }

  /**
   * 选择任意存活且非自己的目标。
   */
  private pickAliveNotSelf(actorId: EntityId): EntityId | null {
    const target = this.world.getAliveEntityIds().find((id) => id !== actorId);
    return target ?? null;
  }

  /**
   * 按阵营选择存活目标，找不到则回退到任意非自己目标。
   */
  private pickAliveByCamp(actorId: EntityId, camp: Camp): EntityId | null {
    const target = this.world.getAliveEntityIds().find((id) => {
      const role = this.world.getComponent(id, COMPONENT.Role);
      return id !== actorId && role?.camp === camp;
    });
    // 若指定阵营无可选目标，兜底选任意存活非自己玩家。
    return target ?? this.pickAliveNotSelf(actorId);
  }

  private parseCamp(camp: "good" | "wolf" | "third_party"): Camp {
    if (camp === "wolf") {
      return Camp.Wolf;
    }
    if (camp === "third_party") {
      return Camp.ThirdParty;
    }
    return Camp.Good;
  }
}
