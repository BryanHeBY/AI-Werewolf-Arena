import { prohibitsLoversVote } from "../../../game/mechanisms/roles/cupid/relation";
import { text } from "@ai-werewolf-arena/game-text";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  Camp,
  EntityId,
  Phase,
  Role,
  ToolCall,
} from "../../../core/domain";
import { World } from "../../../core/domain/world";
import {
  RoleCatalog,
  getDefaultRoleCatalog,
  wolfTeamPermissions,
  allNightAbilities,
  activeNightAbility,
  roleInspectionPolicy,
  ROLE_INSPECTION_POLICY_ROLES,
} from "../../../game/mechanisms";
import { canBeExiled, canBeSheriff, canVote } from "../../../game/mechanisms/common/participation";

/**
 * Noop 行为提供器：用于测试“无人行动”场景。
 */
export class NoopActionProvider implements ActionProvider {
  /**
   * 恒定返回空动作，用于测试空行动分支。
   */
  async getAction(_request: ActionRequest): Promise<ToolCall | null> {
    return null;
  }
}

/**
 * 脚本动作匹配条目。
 */
export interface ScriptedEntry {
  match: (request: ActionRequest) => boolean;
  action: ToolCall | null;
}

/**
 * Scripted 行为提供器：按预置脚本回放动作，适合单元测试与复现 bug。
 */
export class ScriptedActionProvider implements ActionProvider {
  private readonly entries: ScriptedEntry[];

  constructor(entries: ScriptedEntry[]) {
    this.entries = [...entries];
  }

  /**
   * 按首个命中规则返回脚本动作，并移除该规则避免重复触发。
   */
  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const index = this.entries.findIndex((entry) => entry.match(request));
    if (index === -1) {
      return null;
    }

    const [entry] = this.entries.splice(index, 1);
    return entry.action;
  }
}

/**
 * 基线机器人：在 LLM 不可用时提供可推进对局的兜底动作。
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
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
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
      bound?.kind === "role_check"
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
    const roleProfile = this.roleCatalog.get(abilityRole);
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
      const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
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
