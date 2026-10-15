/**
 * 负责通用、警长和角色运行贡献的领域工具索引，以及有序本地化提示和指令。输入为原规格与指令数组；输出为同一规格和展示文字，不授予行动权限。重复的自有数据 schema 必须完全一致；兼容或不透明覆盖保留最后原引用与原文。参数 getter 和 schema 解析仍延迟至 ActionReception 首次使用；不合并 SDK／MCP 三项传输工具或写入领域状态。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { registerToolSpecs } from "../../rulesets/tool-spec-registration";
import { ToolName } from "../../domain/model";
import { COMMON_TOOL_SPECS } from "./common-tool-specs";
import { StageDirectiveRule, ToolSpec } from "./tool-contracts";
import { RoleCatalog } from "../../rulesets/roles/catalog";
import { getDefaultRoleCatalog } from "../../rulesets/roles/role-catalog-assembly";
import { SHERIFF_TOOL_SPECS } from "../../features/sheriff/tool-specs";

function buildDefaultSpecs(roleProfileRegistry: RoleCatalog): ToolSpec[] {
  const specs: ToolSpec[] = [...COMMON_TOOL_SPECS, ...SHERIFF_TOOL_SPECS];
  for (const { runtime: profile } of roleProfileRegistry.allRuntime()) {
    if (profile.toolSpecs) {
      specs.push(...profile.toolSpecs);
    }
  }
  return specs;
}

function buildDefaultStageDirectives(roleProfileRegistry: RoleCatalog): StageDirectiveRule[] {
  const directives: StageDirectiveRule[] = [];
  for (const { runtime: profile } of roleProfileRegistry.allRuntime()) {
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
    registerToolSpecs(this.specByName, effectiveSpecs);
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
    // 调用方可以复制内建规则后覆盖原文；只在原文仍等于内建字节时采用对应翻译。
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
