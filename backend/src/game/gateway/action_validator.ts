import { RuleError, type RuleViolation } from "@ai-werewolf-arena/game-catalog";
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { AliveComponent } from "../../core/domain/components/alive";
import { COMPONENT } from "../../core/domain/components/names";
import { RoleComponent } from "../../core/domain/components/role";
import {
  ActionWindow,
  EntityId,
  Phase,
  ToolCall,
  ToolValidationResult,
} from "../../core/domain/model";
import {
  getDefaultToolValidationRuleRegistry,
  ToolValidationRuleRegistry,
} from "../mechanisms";
import { safeRecordLogicOp } from "../../recording/session_recorder";
import { World } from "../../core/domain/world";

/**
 * 动作校验上下文。
 */
export interface ValidationContext {
  day?: number;
  abilityId?: string;
  phase: Phase;
  actionWindow?: ActionWindow;
  allowSelfDestruct?: boolean;
  deathActionId?: number;
}

/**
 * ActionValidator 是“规则防线”。
 * 所有模型工具调用在落地前都必须通过这里，非法动作统一返回错误并要求重试。
 */
export class ActionValidator {
  constructor(
    private readonly ruleRegistry: ToolValidationRuleRegistry = getDefaultToolValidationRuleRegistry(),
    private readonly recordOperations = true,
  ) {}

  validate<T extends ToolCall>(
    world: World,
    actorId: EntityId,
    toolCall: T,
    context: ValidationContext,
  ): ToolValidationResult<T> {
    const reject = (violation: RuleViolation): ToolValidationResult<T> => {
      if (this.recordOperations) safeRecordLogicOp({
        scope: "gateway",
        op: "validate_tool_call",
        actorId,
        phase: context.phase,
        status: "rejected",
        reason: violation.code,
        input: {
          tool: toolCall.name,
          args: (toolCall as any).args ?? {},
          action_window: context.actionWindow,
        },
      });
      return toolFailure(world.locale, violation.code, violation.message);
    };
    const accept = (): ToolValidationResult<T> => {
      if (this.recordOperations) safeRecordLogicOp({
        scope: "gateway",
        op: "validate_tool_call",
        actorId,
        phase: context.phase,
        status: "ok",
        input: {
          tool: toolCall.name,
          args: (toolCall as any).args ?? {},
          action_window: context.actionWindow,
        },
      });
      return {
        ok: true,
        sanitizedCall: toolCall,
      };
    };

    const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
    const alive = world.getComponent<AliveComponent>(actorId, COMPONENT.Alive);

    if (!role || !alive) {
      return reject({ code: RuleError.ActorMissing });
    }

    const allowDeadAction = world.hasDeathAction(actorId, toolCall.name, context.phase, context.day, context.deathActionId);
    if (context.deathActionId !== undefined && (alive.alive || !allowDeadAction)) {
      return reject({ code: RuleError.DeathActionUnavailable });
    }
    if (!alive.alive && !allowDeadAction) {
      return reject({ code: RuleError.ActorDead });
    }
    if (toolCall.name === "shoot" && (alive.alive || !allowDeadAction)) {
      return reject({ code: RuleError.ShootUnavailable });
    }

    const error = this.ruleRegistry.validate({
      world,
      actorId,
      role,
      toolCall,
      phase: context.phase,
      day: context.day,
      abilityId: context.abilityId,
      actionWindow: context.actionWindow,
      allowSelfDestruct: context.allowSelfDestruct,
    });
    if (error) {
      return reject(error);
    }

    return accept();
  }
}
