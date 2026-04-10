import { AliveComponent } from "../domain/components/alive";
import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import {
  ActionWindow,
  EntityId,
  Phase,
  ToolCall,
  ToolValidationResult,
} from "../domain/model";
import {
  getDefaultToolValidationRuleRegistry,
  ToolValidationRuleRegistry,
} from "../mechanisms";
import { safeRecordLogicOp } from "../session_recording";
import { World } from "../domain/world";

/**
 * 动作校验上下文。
 */
export interface ValidationContext {
  phase: Phase;
  actionWindow?: ActionWindow;
  allowSelfDestruct?: boolean;
  allowDeadHunterShoot?: boolean;
  allowDeadLastWords?: boolean;
}

/**
 * ActionValidator 是“规则防线”。
 * 所有模型工具调用在落地前都必须通过这里，非法动作统一返回错误并要求重试。
 */
export class ActionValidator {
  constructor(
    private readonly ruleRegistry: ToolValidationRuleRegistry = getDefaultToolValidationRuleRegistry(),
  ) {}

  validate<T extends ToolCall>(
    world: World,
    actorId: EntityId,
    toolCall: T,
    context: ValidationContext,
  ): ToolValidationResult<T> {
    const reject = (message: string): ToolValidationResult<T> => {
      safeRecordLogicOp({
        scope: "gateway",
        op: "validate_tool_call",
        actorId,
        phase: context.phase,
        status: "rejected",
        reason: message,
        input: {
          tool: toolCall.name,
          args: (toolCall as any).args ?? {},
          action_window: context.actionWindow,
        },
      });
      return { ok: false, error: message };
    };
    const accept = (): ToolValidationResult<T> => {
      safeRecordLogicOp({
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
      return reject("非法操作，玩家组件不存在");
    }

    const allowDeadAction =
      (toolCall.name === "shoot" && context.allowDeadHunterShoot) ||
      (toolCall.name === "speak" && context.allowDeadLastWords);
    if (!alive.alive && !allowDeadAction) {
      return reject("非法操作，死亡玩家无法行动");
    }

    const error = this.ruleRegistry.validate({
      world,
      actorId,
      role,
      toolCall,
      phase: context.phase,
      actionWindow: context.actionWindow,
      allowSelfDestruct: context.allowSelfDestruct,
    });
    if (error) {
      return reject(error);
    }

    return accept();
  }
}
