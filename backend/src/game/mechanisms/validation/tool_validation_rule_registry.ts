import { RuleError, type RuleViolation } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：聚合通用/角色/机制校验规则并提供统一校验入口。 */
import { ToolName } from "../../../core/domain/model";
import { COMMON_VALIDATION_RULES } from "../common/validation_rules";
import { RoleCatalog, getDefaultRoleCatalog } from "../roles/catalog";
import { SHERIFF_VALIDATION_RULES } from "../sheriff/validation_rules";
import { ToolRuleMap, ValidationRuleContext } from "./contracts";
import { validateGiftGun } from "../roles/death_abilities";

function buildDefaultRules(roleProfileRegistry: RoleCatalog): ToolRuleMap {
  const rules: ToolRuleMap = {
    ...COMMON_VALIDATION_RULES,
    ...SHERIFF_VALIDATION_RULES,
  };
  for (const profile of roleProfileRegistry.all()) {
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
    // Two roles may share a tool name while owning different resources/rules.
    const rule =
      (this.useProfileRules
        ? this.roleProfileRegistry.get(ctx.role.role)?.validationRules?.[ctx.toolCall.name]
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
