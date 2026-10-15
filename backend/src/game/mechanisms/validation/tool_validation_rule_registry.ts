/**
 * 负责聚合通用、警长和角色运行校验贡献。输入为原上下文与工具调用；输出为首个规则拒绝或 null。
 * 有来源赠枪保留专属校验，普通角色在原时点读取当前规则；不提交动作、付款或执行结算。
 */
import { RuleError, type RuleViolation } from "@ai-werewolf-arena/game-contract";
import { ToolName } from "../../../domain/model";
import { COMMON_VALIDATION_RULES } from "../common/validation_rules";
import { RoleCatalog } from "../roles/catalog";
import { getDefaultRoleCatalog } from "../roles/role-catalog-assembly";
import { SHERIFF_VALIDATION_RULES } from "../sheriff/validation_rules";
import { ToolRuleMap, ValidationRuleContext } from "./contracts";
import { validateGiftGun } from "../roles/death_abilities";

function buildDefaultRules(roleProfileRegistry: RoleCatalog): ToolRuleMap {
  const rules: ToolRuleMap = {
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

  constructor(
    rules?: ToolRuleMap,
    private readonly roleProfileRegistry: RoleCatalog = getDefaultRoleCatalog(),
  ) {
    this.rules = { ...(rules ?? buildDefaultRules(roleProfileRegistry)) };
    this.useProfileRules = rules === undefined;
  }

  validate(ctx: Omit<ValidationRuleContext, "roleCatalog">): RuleViolation | null {
    if (this.useProfileRules && ctx.toolCall.name === "shoot" && ctx.abilityId !== undefined)
      return validateGiftGun({ ...ctx, roleCatalog: this.roleProfileRegistry });
    // 同名工具可以归不同角色库存；在原调用点按当前角色读取规则，不能只靠全局索引授权。
    const rule =
      (this.useProfileRules
        ? this.roleProfileRegistry.runtime(ctx.role.role)?.validationRules?.[ctx.toolCall.name]
        : undefined) ?? this.rules[ctx.toolCall.name as ToolName];
    if (!rule) {
      return { code: RuleError.UnknownTool };
    }
    const result = rule({ ...ctx, roleCatalog: this.roleProfileRegistry });
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
