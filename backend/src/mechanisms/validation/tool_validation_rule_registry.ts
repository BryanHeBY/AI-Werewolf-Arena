import { ToolName } from "../../domain/model";
import { COMMON_VALIDATION_RULES } from "../common/validation_rules";
import { GUARD_VALIDATION_RULES } from "../roles/guard/validation_rules";
import { HUNTER_VALIDATION_RULES } from "../roles/hunter/validation_rules";
import { SEER_VALIDATION_RULES } from "../roles/seer/validation_rules";
import { WITCH_VALIDATION_RULES } from "../roles/witch/validation_rules";
import { WOLF_VALIDATION_RULES } from "../roles/wolf/validation_rules";
import { SHERIFF_VALIDATION_RULES } from "../sheriff/validation_rules";
import { ToolRuleMap, ValidationRuleContext } from "./contracts";

const defaultRules: ToolRuleMap = {
  ...COMMON_VALIDATION_RULES,
  ...WOLF_VALIDATION_RULES,
  ...GUARD_VALIDATION_RULES,
  ...SEER_VALIDATION_RULES,
  ...WITCH_VALIDATION_RULES,
  ...HUNTER_VALIDATION_RULES,
  ...SHERIFF_VALIDATION_RULES,
};

export class ToolValidationRuleRegistry {
  private readonly rules: ToolRuleMap;

  constructor(rules: ToolRuleMap = defaultRules) {
    this.rules = { ...rules };
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

export function getDefaultToolValidationRuleRegistry(): ToolValidationRuleRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolValidationRuleRegistry();
  }
  return defaultRegistry;
}
