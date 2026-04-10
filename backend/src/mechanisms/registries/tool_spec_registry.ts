import { ToolName } from "../../domain/model";
import { COMMON_TOOL_SPECS } from "../common/tool_specs";
import { StageDirectiveRule, ToolSpec } from "../contracts";
import { GUARD_TOOL_SPECS } from "../roles/guard/tool_specs";
import { HUNTER_TOOL_SPECS } from "../roles/hunter/tool_specs";
import { SEER_TOOL_SPECS } from "../roles/seer/tool_specs";
import { WITCH_STAGE_DIRECTIVES, WITCH_TOOL_SPECS } from "../roles/witch/tool_specs";
import { WOLF_STAGE_DIRECTIVES, WOLF_TOOL_SPECS } from "../roles/wolf/tool_specs";
import { SHERIFF_TOOL_SPECS } from "../sheriff/tool_specs";

const DEFAULT_SPECS: ToolSpec[] = [
  ...COMMON_TOOL_SPECS,
  ...WOLF_TOOL_SPECS,
  ...GUARD_TOOL_SPECS,
  ...SEER_TOOL_SPECS,
  ...WITCH_TOOL_SPECS,
  ...HUNTER_TOOL_SPECS,
  ...SHERIFF_TOOL_SPECS,
];

const DEFAULT_STAGE_DIRECTIVES: StageDirectiveRule[] = [
  ...WOLF_STAGE_DIRECTIVES,
  ...WITCH_STAGE_DIRECTIVES,
];

export class ToolSpecRegistry {
  private readonly specByName = new Map<ToolName, ToolSpec>();
  private readonly stageDirectives: StageDirectiveRule[];

  constructor(
    specs: ToolSpec[] = DEFAULT_SPECS,
    stageDirectives: StageDirectiveRule[] = DEFAULT_STAGE_DIRECTIVES,
  ) {
    for (const spec of specs) {
      this.specByName.set(spec.name, spec);
    }
    this.stageDirectives = [...stageDirectives];
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
