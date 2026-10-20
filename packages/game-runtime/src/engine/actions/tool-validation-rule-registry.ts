/**
 * 负责聚合通用、警长和角色运行校验贡献。输入为原上下文与工具调用；输出为首个规则拒绝或 null。
 * 有来源赠枪保留专属校验，普通角色在原时点读取当前规则；不提交动作、付款或执行结算。
 */
import { RuleError, type RuleViolation } from "@ai-werewolf-arena/game-contract";
import { ToolName } from "../../domain/model";
import { COMMON_VALIDATION_RULES } from "./common-validation-rules";
import { RoleCatalog } from "../../rulesets/roles/catalog";
import { getDefaultRoleCatalog } from "../../rulesets/roles/role-catalog-assembly";
import { SHERIFF_VALIDATION_RULES } from "../../features/sheriff/validation-ports";
import type { ToolRuleMap } from "./validation-contracts";
import {
  invokeValidationRule,
  type ValidationHostInput,
  type RawAdmissionResult,
  type ValidationScopeInput,
} from "./validation-queries";
import { createDefaultActionValidationAssembly } from "../../rulesets/action-validation-assembly";
import type { World } from "../../domain/world";
import type { ActionRequest } from "../../domain/actions";
import type { ToolName as ContractToolName } from "@ai-werewolf-arena/game-contract";
import { validateWardenNativeTarget } from "../../rulesets/warden-native-target-validation";
import { validateDeathShotSource } from "../../rulesets/death-shot-source-validation";

function buildDefaultRules(
  roleProfileRegistry: RoleCatalog,
  commonRules: ToolRuleMap,
): ToolRuleMap {
  const rules: ToolRuleMap = {
    ...commonRules,
    ...COMMON_VALIDATION_RULES,
    ...SHERIFF_VALIDATION_RULES,
  };
  for (const { runtime: profile } of roleProfileRegistry.allRuntime()) {
    if (profile.validationRules) {
      Object.assign(rules, profile.validationRules);
    }
  }
  return rules;
}

/** 工具校验规则注册表。 */
export class ToolValidationRuleRegistry {
  private readonly rules: ToolRuleMap;
  private readonly useProfileRules: boolean;
  private readonly admission: ReturnType<typeof createDefaultActionValidationAssembly>;

  constructor(
    rules?: ToolRuleMap,
    private readonly roleProfileRegistry: RoleCatalog = getDefaultRoleCatalog(),
  ) {
    this.admission = createDefaultActionValidationAssembly();
    this.rules = {
      ...(rules ?? buildDefaultRules(roleProfileRegistry, this.admission.commonRules)),
    };
    this.useProfileRules = rules === undefined;
  }

  /** 原 raw 程序按可信装配顺序执行；首拒绝立即返回，参数读取和 getter 异常不吞掉。 */
  prepareRawArgs(
    world: World,
    request: ActionRequest,
    tool: ContractToolName,
    rawArgs: unknown,
  ): RawAdmissionResult {
    let args: Record<string, unknown> | undefined;
    for (const contribution of this.admission.raw) {
      const raw = contribution.raw;
      if (!raw) continue;
      const result = raw(world, request, tool, rawArgs);
      if (!result.ok) return result;
      if (result.args !== undefined) args = result.args;
    }
    return { ok: true, ...(args !== undefined ? { args } : {}) };
  }

  /** 每次接收都观察原全部证明；只用静态 owner 身份路由，不缓存许可、不向扩展返回证明。 */
  captureRequestScopes(world: World, request: ActionRequest): readonly ValidationScopeInput[] {
    return this.admission.scopes.map((contribution) => {
      const capture = contribution.capture;
      return { owner: contribution.owner, scope: capture(world, request) };
    });
  }

  validate(ctx: Omit<ValidationHostInput, "roleCatalog">): RuleViolation | null {
    if (this.useProfileRules) {
      const warden = validateWardenNativeTarget({ ...ctx, roleCatalog: this.roleProfileRegistry });
      if (warden) return warden;
    }
    if (this.useProfileRules && ctx.toolCall.name === "shoot" && ctx.abilityId !== undefined)
      return validateDeathShotSource({ ...ctx, roleCatalog: this.roleProfileRegistry });
    // 同名工具可以归不同角色库存；在原调用点按当前角色读取规则，不能只靠全局索引授权。
    const rule =
      (this.useProfileRules
        ? this.roleProfileRegistry.runtime(ctx.role.role)?.validationRules?.[ctx.toolCall.name]
        : undefined) ?? this.rules[ctx.toolCall.name as ToolName];
    if (!rule) {
      return { code: RuleError.UnknownTool };
    }
    const result = invokeValidationRule(rule, { ...ctx, roleCatalog: this.roleProfileRegistry });
    return !result
      ? null
      : typeof result === "string"
        ? { code: RuleError.CustomRuleError, message: result }
        : result;
  }
}

let defaultRegistry: ToolValidationRuleRegistry | null = null;

/** 获取默认工具校验规则注册表实例。 */
export function getDefaultToolValidationRuleRegistry(): ToolValidationRuleRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolValidationRuleRegistry();
  }
  return defaultRegistry;
}
