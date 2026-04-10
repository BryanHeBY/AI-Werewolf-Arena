import { ToolName } from "../../domain/model";
import { COMMON_TOOL_SPECS } from "../common/tool_specs";
import { StageDirectiveRule, ToolSpec } from "../contracts";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "../roles/profile_registry";
import { SHERIFF_TOOL_SPECS } from "../sheriff/tool_specs";

function buildDefaultSpecs(roleProfileRegistry: RoleProfileRegistry): ToolSpec[] {
  const specs: ToolSpec[] = [...COMMON_TOOL_SPECS, ...SHERIFF_TOOL_SPECS];
  for (const profile of roleProfileRegistry.all()) {
    if (profile.toolSpecs) {
      specs.push(...profile.toolSpecs);
    }
  }
  return specs;
}

function buildDefaultStageDirectives(
  roleProfileRegistry: RoleProfileRegistry,
): StageDirectiveRule[] {
  const directives: StageDirectiveRule[] = [];
  for (const profile of roleProfileRegistry.all()) {
    if (profile.stageDirectives) {
      directives.push(...profile.stageDirectives);
    }
  }
  return directives;
}

export class ToolSpecRegistry {
  private readonly specByName = new Map<ToolName, ToolSpec>();
  private readonly stageDirectives: StageDirectiveRule[];

  constructor(
    specs?: ToolSpec[],
    stageDirectives?: StageDirectiveRule[],
    roleProfileRegistry: RoleProfileRegistry = getDefaultRoleProfileRegistry(),
  ) {
    const effectiveSpecs = specs ?? buildDefaultSpecs(roleProfileRegistry);
    const effectiveDirectives =
      stageDirectives ?? buildDefaultStageDirectives(roleProfileRegistry);
    for (const spec of effectiveSpecs) {
      this.specByName.set(spec.name, spec);
    }
    this.stageDirectives = [...effectiveDirectives];
  }

  get(name: ToolName): ToolSpec | undefined {
    return this.specByName.get(name);
  }

  getMany(names: ToolName[]): ToolSpec[] {
    return names
      .map((name) => this.specByName.get(name))
      .filter((item): item is ToolSpec => Boolean(item));
  }

  getArgHint(name: ToolName): string | null {
    return this.specByName.get(name)?.argHint ?? null;
  }

  getLlmSchema(name: ToolName): ToolSpec["llm"] | null {
    return this.specByName.get(name)?.llm ?? null;
  }

  getGatewaySchemas(): Array<{ name: ToolName; schema: unknown }> {
    const out: Array<{ name: ToolName; schema: unknown }> = [];
    for (const spec of this.specByName.values()) {
      if (spec.gatewaySchema !== undefined) {
        out.push({ name: spec.name, schema: spec.gatewaySchema });
      }
    }
    return out;
  }

  getStageDirective(allowedTools: ToolName[]): string | null {
    const matched = this.stageDirectives.find((rule) => rule.match(allowedTools));
    return matched?.text ?? null;
  }
}

let defaultRegistry: ToolSpecRegistry | null = null;

export function getDefaultToolSpecRegistry(): ToolSpecRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolSpecRegistry();
  }
  return defaultRegistry;
}
