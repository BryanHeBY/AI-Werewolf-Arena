import {
  ActionWindow,
  EntityId,
  Phase,
  ToolCall,
  ToolName,
  ToolValidationResult,
} from "../../core/domain/model";
import { World } from "../../core/domain/world";
import { ActionValidator } from "./action_validator";

const RESERVED_PREFIX = /^(\s*\[(上帝|法官|系统|God|Judge|System)\]\s*)+/gi;

/**
 * ToolGateway 负责两件事：
 * 在执行前做输入清洗与领域规则校验。传输入参的JSON Schema由ActionReception持有。
 */
export class ToolGateway {
  private readonly validator: ActionValidator;

  constructor(validator: ActionValidator = new ActionValidator()) {
    this.validator = validator;
  }

  validateAndSanitize<T extends ToolCall>(
    world: World,
    actorId: EntityId,
    toolCall: T,
    context: {
      day?: number;
      abilityId?: string;
      phase: Phase;
      actionWindow?: ActionWindow;
      allowSelfDestruct?: boolean;
      duelWindow?: import("../../core/domain/identity").KnightDuelWindow;
      allowKnightDuel?: boolean;
      deathActionId?: number;
      sheriffCandidates?: readonly EntityId[];
    },
  ): ToolValidationResult<T> {
    const sanitizedCall = this.sanitize(toolCall);
    return this.validator.validate(world, actorId, sanitizedCall, context);
  }

  private sanitize<T extends ToolCall>(call: T): T {
    if (call.name === "speak") {
      const raw = call.args.text;
      // 防止模型伪造系统身份前缀，避免污染公共上下文。
      const text = raw.replace(RESERVED_PREFIX, "").trim();
      return {
        ...call,
        args: {
          ...call.args,
          text,
        },
      } as T;
    }
    if (call.name === "speak_to_wolves") {
      const raw = call.args.text;
      const text = raw.replace(RESERVED_PREFIX, "").trim();
      return {
        ...call,
        args: {
          ...call.args,
          text,
          end_chat: Boolean(call.args.end_chat),
        },
      } as T;
    }
    return call;
  }
}
