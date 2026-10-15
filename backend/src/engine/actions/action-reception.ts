/**
 * 负责完整行动接收预检：允许工具、首用 JSON schema、原参数修复、机制请求作用域和领域规则。
 * 输入为同一 World、原请求与外来工具参数；输出为脱离后的合法候选或原结构化拒绝。
 * 每实例只持有原 schema 缓存和不写第二 Tape 校验的 Gateway；schema 与具体 scope 仍按原时点晚读。
 * 本 owner 不消耗库存、提交领域动作或 settle 完成责任；选择／截止窗口由 AI ActionTurn 独立拥有。
 */
import { z, type ZodType } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { DEATH_SHOT_STAGES, type ActionRequest, type ToolCall, type ToolName } from "../../domain";
import { World } from "../../domain/world";
import { ActionValidator } from "./action-validator";
import { ToolGateway } from "./tool-gateway";
import {
  getDefaultToolCallRepairRegistry,
  getDefaultToolValidationRuleRegistry,
  type ToolCallRepairRegistry,
  type ToolValidationRuleRegistry,
} from "../../rulesets/mechanism-api";
import { getDefaultToolSpecRegistry, type ToolSpecRegistry } from "./tool-spec-registry";
import { evaluateTurnConstraints, resolveTurnConstraints } from "./turn-constraints";
import type { Locale } from "@ai-werewolf-arena/game-contract";

/** 只描述预检结果，不表示领域已付款或生效；可选回合字段保留原拒绝结构接受集合。 */
export type GameActionValidation =
  | { ok: true; action: ToolCall }
  | {
      ok: false;
      error: string;
      message: string;
      details?: string[];
      expected_turn_id?: string;
      received_turn_id?: unknown;
    };

/**
 * 选择窗口的类型接口只声明原 locale 与预检函数，不提供写方法或领域完成接口。
 * 实际接收器不公开 World；语言在原调用点晚读，领域写入仍不属于此接口。
 */
export interface ActionPreflightPort {
  readonly locale: Locale;

  validate(request: ActionRequest, name: string, rawArgs: unknown): GameActionValidation;
}
type Validation = GameActionValidation;

/** 预检只形成候选；实际应用与资源消费仍由引擎和具体机制提交。 */
export class ActionReception {
  private readonly schemas = new Map<ToolName, ZodType>();
  private readonly gateway: ToolGateway;
  readonly #world: World;
  private readonly rules: ToolValidationRuleRegistry;

  constructor(
    world: World,
    private readonly repair: ToolCallRepairRegistry = getDefaultToolCallRepairRegistry(),
    private readonly specs: ToolSpecRegistry = getDefaultToolSpecRegistry(),
    rules: ToolValidationRuleRegistry = getDefaultToolValidationRuleRegistry(),
  ) {
    this.#world = world;
    this.rules = rules;
    // 这里仍关闭领域校验的 Tape 记录，避免接收预检制造第二次 validation 操作。
    this.gateway = new ToolGateway(new ActionValidator(rules, false));
  }

  get locale(): Locale {
    return this.#world.locale;
  }

  validate(request: ActionRequest, name: string, rawArgs: unknown): Validation {
    const fail = (code: string) => toolFailure(this.#world.locale, code);
    if (!request.allowedTools.includes(name as ToolName) || name === "report_bug") {
      return fail("tool_not_allowed_in_this_turn");
    }
    const tool = name as ToolName;
    const spec = this.specs.get(tool);
    if (!spec || rawArgs === null || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
      return fail("invalid_tool_arguments");
    }
    // 同一工具只在首个合法参数形态的调用建立 schema；建图失败不先写缓存，后续 properties 仍原位读取。
    let schema = this.schemas.get(tool);
    if (!schema) {
      schema = z.fromJSONSchema(spec.parameters);
      this.schemas.set(tool, schema);
    }
    // 保留原数字字符串修复；不把布尔／文本按 truthiness 或 String() 宽转，也不补缺少的必填参数。
    const admission = this.rules.prepareRawArgs(this.#world, request, tool, rawArgs);
    if (!admission.ok) return fail(admission.error);
    // 仅各原 reader 明确规范化的参数取其原对象；一般工具仍在全部 raw 预检后做原 spread。
    const input = (admission.args ?? { ...rawArgs }) as Record<string, unknown>;
    const properties = spec.parameters.properties as
      Record<string, { type?: string | string[] }> | undefined;
    for (const [key, value] of Object.entries(input)) {
      const type = properties?.[key]?.type;
      const numeric =
        type === "number" ||
        type === "integer" ||
        (Array.isArray(type) && (type.includes("number") || type.includes("integer")));
      if (numeric && typeof value === "string" && /^\d+$/.test(value)) input[key] = Number(value);
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail("invalid_tool_arguments");
    const args = this.repair.coerceArgs(tool, parsed.data as Record<string, unknown>, {
      actorId: request.actorId,
    });
    if (!args || !schema.safeParse(args).success) return fail("invalid_tool_arguments");
    const call = { name: tool, args } as ToolCall;
    const deathStage =
      DEATH_SHOT_STAGES.includes(request.context.stage) ||
      request.context.stage === "last_words" ||
      request.context.stage === "sheriff_badge_choice";
    const deathTool =
      (tool === "choose_badge_successor" &&
        request.context.stage === "sheriff_badge_choice" &&
        request.context.trigger === "badge_handoff") ||
      (tool === "shoot" &&
        DEATH_SHOT_STAGES.includes(request.context.stage) &&
        request.context.trigger === "on_death") ||
      (tool === "speak" &&
        request.context.stage === "last_words" &&
        request.context.trigger === "last_words");
    if (
      deathStage &&
      (!deathTool ||
        !this.#world.hasDeathAction(
          request.actorId,
          tool,
          request.phase,
          request.context.day,
          request.context.death_action_id,
          request.context.ability_id,
        ))
    ) {
      return fail(RuleError.DeathActionUnavailable);
    }
    // 贡献装配保原证明观察顺序；核心不持角色清单，也不提前缓存许可或绕过提交前规则。
    const checked = this.gateway.validateAndSanitize(this.#world, request.actorId, call, {
      phase: request.phase,
      day: request.context.day,
      requestScopes: this.rules.captureRequestScopes(this.#world, request),
      wallId: request.context.wall_id,
      itemInstanceId: request.context.item_instance_id,
      debateId: request.context.debate_id,
      abilityId: request.context.ability_id,
      actionWindow: request.actionWindow,
      sheriffCandidates: request.context.sheriff_candidates,
      exileCandidates: request.context.exile_candidates,
      badgeCandidates: request.context.badge_candidates,
      allowSelfDestruct:
        request.allowedTools.includes("self_destruct") ||
        request.allowedTools.includes("self_destruct_with_target"),
      duelWindow: request.context.duel_window,
      allowKnightDuel:
        request.context.stage === request.context.duel_window &&
        request.allowedTools.includes("duel"),
      deathActionId: deathTool ? request.context.death_action_id : undefined,
    });
    if (!checked.ok || !checked.sanitizedCall) {
      return toolFailure(
        this.#world.locale,
        checked.error ?? "invalid_tool_arguments",
        checked.message,
      );
    }
    const evaluation = evaluateTurnConstraints(
      { validActions: [checked.sanitizedCall] },
      resolveTurnConstraints(request),
      this.#world.locale,
    );
    if (!evaluation.ok) {
      return { ...fail("turn_constraints_not_satisfied"), details: evaluation.errors };
    }
    // 已接受的是脱离的候选，不是领域 commit；库存、租约完成和实际效果仍要在原 owner 重验。
    return { ok: true, action: structuredClone(checked.sanitizedCall) };
  }
}
