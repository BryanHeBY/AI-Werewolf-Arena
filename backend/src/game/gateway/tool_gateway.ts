import {
  ActionWindow,
  EntityId,
  Phase,
  ToolCall,
  ToolName,
  ToolValidationResult,
} from "../../core/domain/model";
import { getDefaultToolSpecRegistry, ToolSpecRegistry } from "../mechanisms";
import { World } from "../../core/domain/world";
import { ActionValidator } from "./action_validator";

const RESERVED_PREFIX = /^(\s*\[(上帝|法官|系统)\]\s*)+/g;

/**
 * ToolGateway 负责两件事：
 * 1) 对外维护可用工具 schema；
 * 2) 在执行前做输入清洗 + 规则校验。
 */
export class ToolGateway {
  private readonly validator: ActionValidator;
  private readonly schemas: Map<ToolName, unknown> = new Map();
  private readonly toolSpecRegistry: ToolSpecRegistry;

  constructor(
    validator: ActionValidator = new ActionValidator(),
    toolSpecRegistry: ToolSpecRegistry = getDefaultToolSpecRegistry(),
  ) {
    this.validator = validator;
    this.toolSpecRegistry = toolSpecRegistry;
    for (const { name, schema } of this.toolSpecRegistry.getGatewaySchemas()) {
      this.registerSchema(name, schema);
    }
  }

  /**
   * 注册单个工具的 schema。
   */
  registerSchema(name: ToolName, schema: unknown): void {
    this.schemas.set(name, schema);
  }

  /**
   * 获取当前已注册 schema 映射。
   */
  getRegisteredSchemas(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [name, schema] of this.schemas.entries()) {
      obj[name] = schema;
    }
    return obj;
  }

  validateAndSanitize<T extends ToolCall>(
    world: World,
    actorId: EntityId,
    toolCall: T,
    context: {
      phase: Phase;
      actionWindow?: ActionWindow;
      allowSelfDestruct?: boolean;
      allowDeadHunterShoot?: boolean;
      allowDeadLastWords?: boolean;
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
