/**
 * 负责按演员生命、角色、可信行动窗口及已注册规则校验工具调用。输入为已清洗调用及校验上下文，输出为原规则结果与配置的校验 trace。
 * 领域预检通过不等于库存付款，本模块不以 schema 接受代替实际资源提交。
 */
import { RuleError, type RuleViolation } from "@ai-werewolf-arena/game-contract";
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { AliveComponent } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { ActionWindow, EntityId, Phase, ToolCall, ToolValidationResult } from "../../domain/model";
import {
  getDefaultToolValidationRuleRegistry,
  ToolValidationRuleRegistry,
} from "../../rulesets/mechanism-api";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import { World } from "../../domain/world";

/**
 * 动作校验上下文。
 */
export interface ValidationContext {
  /** 有事务归属的 controller 只在实际提交后记录校验。 */
  deferOperation?: boolean;
  day?: number;
  /** 原 owner 捕获的证明；并非任意 callback 或 true 能生成的授权。 */
  scope?: object;
  /** 接收器内部按贡献身份关联，公开 ToolRule 不收到此集合。 */
  requestScopes?: readonly import("./validation-queries").ValidationScopeInput[];
  wallId?: string;
  itemInstanceId?: string;
  debateId?: string;
  abilityId?: string;
  phase: Phase;
  actionWindow?: ActionWindow;
  allowSelfDestruct?: boolean;
  duelWindow?: import("../../domain/identity").KnightDuelWindow;
  allowKnightDuel?: boolean;
  deathActionId?: number;
  sheriffCandidates?: readonly EntityId[];
  badgeCandidates?: readonly EntityId[];
  exileCandidates?: readonly EntityId[];
}

/**
 * ActionValidator 是“规则防线”。
 * 领域调用经过原生命／死亡窗口和已注册规则；结构化拒绝与抛错各保原前缀，不把候选接受当作已提交。
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
      if (this.recordOperations && context.deferOperation !== true)
        safeRecordLogicOp({
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
      if (this.recordOperations && context.deferOperation !== true)
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

    const role = world.getComponent(actorId, COMPONENT.Role);
    const alive = world.getComponent(actorId, COMPONENT.Alive);

    if (!role || !alive) {
      return reject({ code: RuleError.ActorMissing });
    }

    const allowDeadAction = world.hasDeathAction(
      actorId,
      toolCall.name,
      context.phase,
      context.day,
      context.deathActionId,
      context.abilityId,
    );
    if (context.deathActionId !== undefined && (alive.alive || !allowDeadAction)) {
      return reject({ code: RuleError.DeathActionUnavailable });
    }
    if (!alive.alive && !allowDeadAction) {
      return reject({ code: RuleError.ActorDead });
    }
    if (toolCall.name === "choose_badge_successor" && (alive.alive || !allowDeadAction))
      return reject({ code: RuleError.DeathActionUnavailable });
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
      scope: context.scope,
      requestScopes: context.requestScopes,
      wallId: context.wallId,
      itemInstanceId: context.itemInstanceId,
      debateId: context.debateId,
      abilityId: context.abilityId,
      actionWindow: context.actionWindow,
      allowSelfDestruct: context.allowSelfDestruct,
      duelWindow: context.duelWindow,
      allowKnightDuel: context.allowKnightDuel,
      sheriffCandidates: context.sheriffCandidates,
      exileCandidates: context.exileCandidates,
      badgeCandidates: context.badgeCandidates,
    });
    if (error) {
      return reject(error);
    }

    return accept();
  }
}
