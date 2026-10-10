import { sanitizeSpeechText } from "../../utils/speech_text";
import { EntityId, ToolCall, ToolValidationResult } from "../../core/domain/model";
import { World } from "../../core/domain/world";
import { ActionValidator, type ValidationContext } from "./action_validator";

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
    context: ValidationContext,
  ): ToolValidationResult<T> {
    const sanitizedCall = this.sanitize(toolCall);
    return this.validator.validate(world, actorId, sanitizedCall, context);
  }

  private sanitize<T extends ToolCall>(call: T): T {
    if (call.name === "speak") {
      const raw = call.args.text;
      // 防止模型伪造系统身份前缀，避免污染公共上下文。
      const text = sanitizeSpeechText(raw);
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
      const text = sanitizeSpeechText(raw);
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
