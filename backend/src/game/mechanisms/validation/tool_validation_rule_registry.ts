/** 文件说明：聚合通用/角色/机制校验规则并提供统一校验入口。 */
import { ToolName } from "../../../core/domain/model";
import { COMMON_VALIDATION_RULES } from "../common/validation_rules";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "../roles/profile_registry";
import { SHERIFF_VALIDATION_RULES } from "../sheriff/validation_rules";
import { ToolRuleMap, ValidationRuleContext } from "./contracts";

function buildDefaultRules(roleProfileRegistry: RoleProfileRegistry): ToolRuleMap {
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

  constructor(
    rules?: ToolRuleMap,
    roleProfileRegistry: RoleProfileRegistry = getDefaultRoleProfileRegistry(),
  ) {
    this.rules = { ...(rules ?? buildDefaultRules(roleProfileRegistry)) };
  }

  validate(ctx: ValidationRuleContext): string | null {
    const rule = this.rules[ctx.toolCall.name as ToolName];
    if (!rule) {
      return "非法操作，未知工具";
    }
    return rule(ctx);
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
