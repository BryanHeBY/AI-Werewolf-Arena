import { text, type Locale } from "@ai-werewolf-arena/game-text";
/** 文件说明：汇总工具规格与阶段提示规则。 */
import { ToolName } from "../../../core/domain/model";
import { COMMON_TOOL_SPECS } from "../common/tool_specs";
import { StageDirectiveRule, ToolSpec } from "../contracts";
import { RoleCatalog, getDefaultRoleCatalog } from "../roles/catalog";
import { SHERIFF_TOOL_SPECS } from "../sheriff/tool_specs";

function buildDefaultSpecs(roleProfileRegistry: RoleCatalog): ToolSpec[] {
  const specs: ToolSpec[] = [...COMMON_TOOL_SPECS, ...SHERIFF_TOOL_SPECS];
  for (const profile of roleProfileRegistry.all()) {
    if (profile.toolSpecs) {
      specs.push(...profile.toolSpecs);
    }
  }
  return specs;
}

function buildDefaultStageDirectives(roleProfileRegistry: RoleCatalog): StageDirectiveRule[] {
  const directives: StageDirectiveRule[] = [];
  for (const profile of roleProfileRegistry.all()) {
    if (profile.stageDirectives) {
      directives.push(...profile.stageDirectives);
    }
  }
  return directives;
}

/** 工具规格注册表。 */
export class ToolSpecRegistry {
  private readonly specByName = new Map<ToolName, ToolSpec>();
  private readonly stageDirectives: StageDirectiveRule[];

  constructor(
    specs?: ToolSpec[],
    stageDirectives?: StageDirectiveRule[],
    roleProfileRegistry: RoleCatalog = getDefaultRoleCatalog(),
  ) {
    const effectiveSpecs = specs ?? buildDefaultSpecs(roleProfileRegistry);
    const effectiveDirectives = stageDirectives ?? buildDefaultStageDirectives(roleProfileRegistry);
    for (const spec of effectiveSpecs) {
      this.specByName.set(spec.name, spec);
    }
    this.stageDirectives = [...effectiveDirectives];
  }

  get(name: ToolName): ToolSpec | undefined {
    return this.specByName.get(name);
  }

  getArgHint(name: ToolName): string | null {
    return this.specByName.get(name)?.argHint ?? null;
  }

  getUserPromptHint(name: ToolName, locale: Locale = "zh-CN"): string | null {
    const spec = this.specByName.get(name);
    return (
      spec?.userPromptHint ??
      (spec?.userPromptHintKey ? text(locale, spec.userPromptHintKey) : null)
    );
  }

  getStageDirective(allowedTools: ToolName[], locale: Locale = "zh-CN"): string | null {
    const matched = this.stageDirectives.find((rule) => rule.match(allowedTools));
    if (!matched) return null;
    // A caller may spread a built-in rule and replace its text; preserve that override.
    return matched.messageKey && matched.text === text("zh-CN", matched.messageKey)
      ? text(locale, matched.messageKey)
      : matched.text;
  }

  getApplicableUserPromptHints(allowedTools: ToolName[], locale: Locale = "zh-CN"): string[] {
    return allowedTools
      .map((name) => this.getUserPromptHint(name, locale))
      .filter((item): item is string => Boolean(item));
  }
}

let defaultRegistry: ToolSpecRegistry | null = null;

/** 获取默认工具规格注册表实例。 */
export function getDefaultToolSpecRegistry(): ToolSpecRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolSpecRegistry();
  }
  return defaultRegistry;
}
