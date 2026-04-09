import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  Camp,
  EntityId,
  Phase,
  PotionType,
  Role,
  ToolCall,
} from "../domain/model";
import { World } from "../domain/world";

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
  constructor(private readonly world: World) {}

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

    if (request.phase === Phase.Night) {
      if (request.allowedTools.includes("speak_to_wolves") && role.role === Role.Wolf) {
        return {
          name: "speak_to_wolves",
          args: {
            text: "今晚优先刀信息位。",
            end_chat: false,
          },
        };
      }

      if (request.allowedTools.includes("kill_vote") && role.role === Role.Wolf) {
        const target = this.pickAliveByCamp(request.actorId, Camp.Good);
        return target !== null
          ? { name: "kill_vote", args: { target_id: target, abstain: false } }
          : {
              name: "kill_vote",
              args: { target_id: null, abstain: true },
            };
      }

      if (request.allowedTools.includes("guard") && role.role === Role.Guard) {
        const target = this.pickAliveNotSelf(request.actorId);
        return target !== null ? { name: "guard", args: { target_id: target } } : null;
      }

      if (request.allowedTools.includes("check_identity") && role.role === Role.Seer) {
        const target = this.pickAliveNotSelf(request.actorId);
        return target !== null ? { name: "check_identity", args: { target_id: target } } : null;
      }

      if (request.allowedTools.includes("use_potion") && role.role === Role.Witch) {
        // 兜底行为：女巫回合若模型未给出有效动作，默认“本夜不用药”。
        return {
          name: "use_potion",
          args: {
            target_id: request.actorId,
            potion_type: PotionType.None,
          },
        };
      }
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
      return target !== null ? { name: "vote", args: { target_id: target } } : null;
    }

    if (request.allowedTools.includes("shoot")) {
      const target = this.pickAliveNotSelf(request.actorId);
      return target !== null ? { name: "shoot", args: { target_id: target } } : null;
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
}
