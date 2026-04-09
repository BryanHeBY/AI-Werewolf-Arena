import { AliveComponent } from "../domain/components/alive";
import { COMPONENT } from "../domain/components/names";
import { BadgeComponent } from "../domain/components/badge";
import { RoleComponent } from "../domain/components/role";
import { VotingRightComponent } from "../domain/components/voting_right";
import {
  ActionWindow,
  EntityId,
  Phase,
  PotionType,
  Role,
  ToolCall,
  ToolValidationResult,
} from "../domain/model";
import { World } from "../domain/world";

/**
 * 动作校验上下文。
 */
export interface ValidationContext {
  phase: Phase;
  actionWindow?: ActionWindow;
  allowSelfDestruct?: boolean;
  allowDeadHunterShoot?: boolean;
}

/**
 * ActionValidator 是“规则防线”。
 * 所有模型工具调用在落地前都必须通过这里，非法动作统一返回错误并要求重试。
 */
export class ActionValidator {
  validate<T extends ToolCall>(
    world: World,
    actorId: EntityId,
    toolCall: T,
    context: ValidationContext,
  ): ToolValidationResult<T> {
    const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
    const alive = world.getComponent<AliveComponent>(actorId, COMPONENT.Alive);

    if (!role || !alive) {
      return { ok: false, error: "非法操作，玩家组件不存在" };
    }

    if (!alive.alive && !(toolCall.name === "shoot" && context.allowDeadHunterShoot)) {
      return { ok: false, error: "非法操作，死亡玩家无法行动" };
    }

    switch (toolCall.name) {
      case "speak_to_wolves":
      case "kill_vote":
        if (role.role !== Role.Wolf) {
          return { ok: false, error: "非法操作，仅狼人可执行该动作" };
        }
        break;
      case "guard":
        if (role.role !== Role.Guard) {
          return { ok: false, error: "非法操作，仅守卫可守护" };
        }
        if (role.guardState?.lastTarget === toolCall.args.target_id) {
          return { ok: false, error: "非法操作，守卫不可连续两晚守同一人" };
        }
        if (!this.isAliveTarget(world, toolCall.args.target_id)) {
          return { ok: false, error: "非法操作，守护目标必须存活" };
        }
        break;
      case "check_identity":
        if (role.role !== Role.Seer) {
          return { ok: false, error: "非法操作，仅预言家可查验" };
        }
        if (!this.isAliveTarget(world, toolCall.args.target_id)) {
          return { ok: false, error: "非法操作，查验目标必须存活" };
        }
        break;
      case "use_potion":
        if (role.role !== Role.Witch || !role.witchState) {
          return { ok: false, error: "非法操作，仅女巫可用药" };
        }
        if (toolCall.args.potion_type === PotionType.Heal) {
          if (
            !role.witchState.canSelfHeal &&
            toolCall.args.target_id === actorId
          ) {
            return { ok: false, error: "非法操作，本板子女巫不可自救" };
          }
          if (role.witchState.heal <= 0 || role.witchState.healUsedThisNight) {
            return { ok: false, error: "非法操作，解药不可用" };
          }
          if (role.witchState.poisonUsedThisNight) {
            // 与毒药互斥：同一夜最多只能使用一种药。
            return { ok: false, error: "非法操作，同夜不可双药" };
          }
        }
        if (toolCall.args.potion_type === PotionType.Poison) {
          if (role.witchState.poison <= 0 || role.witchState.poisonUsedThisNight) {
            return { ok: false, error: "非法操作，毒药不可用" };
          }
          if (role.witchState.healUsedThisNight) {
            return { ok: false, error: "非法操作，同夜不可双药" };
          }
          if (!this.isAliveTarget(world, toolCall.args.target_id)) {
            return { ok: false, error: "非法操作，毒药目标必须存活" };
          }
        }
        break;
      case "vote": {
        const voting = world.getComponent<VotingRightComponent>(
          actorId,
          COMPONENT.VotingRight,
        );
        if (!voting?.canVote) {
          return { ok: false, error: "非法操作，你当前无投票权" };
        }
        if (!this.isAliveTarget(world, toolCall.args.target_id)) {
          return { ok: false, error: "非法操作，投票目标必须存活" };
        }
        break;
      }
      case "shoot":
        if (role.role !== Role.Hunter || !role.hunterState?.canShoot) {
          return { ok: false, error: "非法操作，当前不可开枪" };
        }
        if (!this.isAliveTarget(world, toolCall.args.target_id)) {
          return { ok: false, error: "非法操作，开枪目标必须存活" };
        }
        break;
      case "self_destruct":
        if (role.role !== Role.Wolf) {
          return { ok: false, error: "非法操作，仅狼人可自爆" };
        }
        if (context.phase !== Phase.Day && context.phase !== Phase.Voting) {
          return { ok: false, error: "非法操作，自爆仅可在白天阶段触发" };
        }
        if (!context.allowSelfDestruct) {
          return { ok: false, error: "非法操作，当前窗口不允许自爆" };
        }
        break;
      case "choose_direction": {
        const badge = world.getComponent<BadgeComponent>(actorId, COMPONENT.Badge);
        if (!badge?.isSheriff || badge.destroyed) {
          return { ok: false, error: "非法操作，仅警长可决定发言顺序" };
        }
        if (context.phase !== Phase.Day) {
          return { ok: false, error: "非法操作，仅白天可决定发言顺序" };
        }
        break;
      }
      case "speak":
        break;
      default:
        return { ok: false, error: "非法操作，未知工具" };
    }

    return {
      ok: true,
      sanitizedCall: toolCall,
    };
  }

  /**
   * 判断目标玩家是否为存活状态。
   */
  private isAliveTarget(world: World, targetId: EntityId): boolean {
    const alive = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive);
    return alive?.alive === true;
  }
}
