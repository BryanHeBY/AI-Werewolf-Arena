import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  Camp,
  EntityId,
  Phase,
  ToolCall,
} from "../../domain/model";
import { World } from "../../domain/world";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "../../mechanisms";

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
  private readonly roleProfileRegistry: RoleProfileRegistry;

  constructor(
    private readonly world: World,
    roleProfileRegistry: RoleProfileRegistry = getDefaultRoleProfileRegistry(),
  ) {
    this.roleProfileRegistry = roleProfileRegistry;
  }

  /**
   * 根据阶段与角色生成默认动作。
   */
  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    if (!role) {
      return null;
    }

    if (request.allowedTools.includes("choose_direction")) {
      // 基线策略：偶数位顺时针，奇数位逆时针，保证可重复。
      return {
        name: "choose_direction",
        args: {
          direction: request.actorId % 2 === 0 ? "clockwise" : "counter_clockwise",
        },
      };
    }

    if (request.phase === Phase.Day && request.allowedTools.includes("speak")) {
      return {
        name: "speak",
        args: {
          text: `我是${request.actorId}号，先听后位发言再判断。`,
        },
      };
    }

    if (request.phase === Phase.Voting && request.allowedTools.includes("vote")) {
      const target = this.pickAliveNotSelf(request.actorId);
      return target !== null
        ? { name: "vote", args: { target_id: target, abstain: false } }
        : { name: "vote", args: { target_id: null, abstain: true } };
    }

    const roleProfile = this.roleProfileRegistry.get(role.role);
    if (roleProfile?.baselineAction) {
      return roleProfile.baselineAction(
        role,
        request,
        () => this.pickAliveNotSelf(request.actorId),
        (camp) => this.pickAliveByCamp(request.actorId, this.parseCamp(camp)),
      );
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
