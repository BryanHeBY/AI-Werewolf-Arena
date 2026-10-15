/**
 * 负责行动提交前的发言文字清洗与领域预检；输入原 World、行动者、调用和上下文，输出原校验结果。
 * JSON Schema 由 ActionReception 持有；本入口按原清洗 → validator 顺序，不消费库存或提交动作。
 * 实例保存原校验器引用，两种发言分支产生浅副本，其它调用保原引用；不是快照、冻结或新许可。
 * getter、清洗与校验异常原样传播，不统一吞错、补偿或保证任意输入都能得到结构化拒绝。
 */
import { sanitizeSpeechText } from "../../utils/speech-text";
import { EntityId, ToolCall, ToolValidationResult } from "../../domain/model";
import { World } from "../../domain/world";
import { ActionValidator, type ValidationContext } from "./action-validator";

/**
 * 网关只形成清洗后的领域校验候选；预检通过不代表付款、请求完成或实际效果已发生。
 */
export class ToolGateway {
  private readonly validator: ActionValidator;

  constructor(validator: ActionValidator = new ActionValidator()) {
    this.validator = validator;
  }

  /** 先完成清洗再读取并调用原 validator；清洗抛错时不进入校验器，不提前读取 World 或上下文字段。 */
  validateAndSanitize<T extends ToolCall>(
    world: World,
    actorId: EntityId,
    toolCall: T,
    context: ValidationContext,
  ): ToolValidationResult<T> {
    const sanitizedCall = this.sanitize(toolCall);
    return this.validator.validate(world, actorId, sanitizedCall, context);
  }

  /** 按原 name 分支读取；仅两种发言造新外层／args 对象，不做其它工具的 schema 或权限校验。 */
  private sanitize<T extends ToolCall>(call: T): T {
    if (call.name === "speak") {
      const raw = call.args.text;
      // 仅清除开头的既有保留前缀并 trim；不删内嵌文字，也不把清洗当作身份认证。
      const text = sanitizeSpeechText(raw);
      // 清洗成功后再按原 spread 次序读取调用和 args；仅浅复制，原嵌套引用与 getter 轨迹保持。
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
          // end_chat 在原两个 spread 与 text 之后才读取，保 Boolean truthiness，不做严格布尔校验。
          end_chat: Boolean(call.args.end_chat),
        },
      } as T;
    }
    // 非发言工具不复制、不归一化参数；领域校验仍在上层的原 validator 调用点执行。
    return call;
  }
}

/** 夜上下文实际只交这个绑定对象；调用方不取得 World 或宿主校验器。 */
export interface BoundToolGateway {
  validateAndSanitize<T extends ToolCall>(
    actorId: EntityId,
    toolCall: T,
    context: ValidationContext,
  ): ToolValidationResult<T>;
}
/**
 * 两个惰性来源均由可信装配捕获。属性读取保 gateway → 原 callee → World，随后才求演员／调用／选项；
 * 原方法实际调用时才判断可调用性，且 receiver 仍是原 gateway。Reflect 准备是新增的有界观察面。
 */
export function createBoundToolGateway(
  gatewaySource: () => ToolGateway,
  worldSource: () => World,
): BoundToolGateway {
  return {
    get validateAndSanitize() {
      const gateway = gatewaySource();
      const callee = gateway.validateAndSanitize;
      const world = worldSource();
      const invoke = Reflect.apply.bind(Reflect);
      return <T extends ToolCall>(
        actorId: EntityId,
        toolCall: T,
        context: ValidationContext,
      ): ToolValidationResult<T> => invoke(callee, gateway, [world, actorId, toolCall, context]);
    },
  };
}
