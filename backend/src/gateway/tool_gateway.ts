import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import {
  ActionWindow,
  EntityId,
  Phase,
  ToolCall,
  ToolName,
  ToolValidationResult,
} from "../domain/model";
import { World } from "../domain/world";
import { ActionValidator } from "./action_validator";
import { guardSchema } from "./schemas/guard.schema";
import { selfDestructSchema } from "./schemas/self_destruct.schema";
import { shootSchema } from "./schemas/shoot.schema";
import { usePotionSchema } from "./schemas/use_potion.schema";

const RESERVED_PREFIX = /^(\s*\[(上帝|法官|系统)\]\s*)+/g;

/**
 * ToolGateway 负责两件事：
 * 1) 对外维护可用工具 schema；
 * 2) 在执行前做输入清洗 + 规则校验。
 */
export class ToolGateway {
  private readonly validator: ActionValidator;
  private readonly schemas: Map<ToolName, unknown> = new Map();

  constructor(validator: ActionValidator = new ActionValidator()) {
    this.validator = validator;
    this.registerSchema("guard", guardSchema);
    this.registerSchema("use_potion", usePotionSchema);
    this.registerSchema("shoot", shootSchema);
    this.registerSchema("self_destruct", selfDestructSchema);
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

  /**
   * 夜晚开始前重置女巫“本夜已用药”状态。
   */
  startNight(world: World): void {
    // 夜晚开始时重置女巫“本夜是否已用药”的瞬时状态。
    for (const id of world.getAliveEntityIds()) {
      const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (role?.witchState) {
        role.witchState.healUsedThisNight = false;
        role.witchState.poisonUsedThisNight = false;
      }
    }
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
    },
  ): ToolValidationResult<T> {
    const sanitizedCall = this.sanitize(toolCall);
    return this.validator.validate(world, actorId, sanitizedCall, context);
  }

  private sanitize<T extends ToolCall>(call: T): T {
    if (call.name === "speak" || call.name === "speak_to_wolves") {
      const raw = call.args.text;
      // 防止模型伪造系统身份前缀，避免污染公共上下文。
      const text = raw.replace(RESERVED_PREFIX, "").trim();
      if (call.name === "speak") {
        return {
          ...call,
          args: {
            ...call.args,
            text,
          },
        } as T;
      }
      return {
        ...call,
        args: {
          ...call.args,
          text,
        },
      } as T;
    }
    return call;
  }
}
