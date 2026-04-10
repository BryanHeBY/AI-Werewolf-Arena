import { ToolCall, ToolName } from "../../domain/model";
import { COMMON_LLM_REPAIR_PACK } from "../common/llm_repair";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "../roles/profile_registry";
import { SHERIFF_LLM_REPAIR_PACK } from "../sheriff/llm_repair";
import { CoerceContext, RecoverContext, ToolRepairPack } from "./contracts";

function buildDefaultPacks(roleProfileRegistry: RoleProfileRegistry): ToolRepairPack[] {
  const packs: ToolRepairPack[] = [COMMON_LLM_REPAIR_PACK, SHERIFF_LLM_REPAIR_PACK];
  for (const profile of roleProfileRegistry.all()) {
    if (profile.llmRepair) {
      packs.push(profile.llmRepair);
    }
  }
  return packs;
}

export class ToolCallRepairRegistry {
  private readonly coerceHandlers = new Map<ToolName, ToolRepairPack["coerce"][ToolName]>();
  private readonly recoverHandlers = new Map<ToolName, ToolRepairPack["recover"][ToolName]>();

  constructor(
    packs?: ToolRepairPack[],
    roleProfileRegistry: RoleProfileRegistry = getDefaultRoleProfileRegistry(),
  ) {
    const effectivePacks = packs ?? buildDefaultPacks(roleProfileRegistry);
    for (const pack of effectivePacks) {
      for (const [name, handler] of Object.entries(pack.coerce)) {
        this.coerceHandlers.set(name as ToolName, handler);
      }
      for (const [name, handler] of Object.entries(pack.recover)) {
        this.recoverHandlers.set(name as ToolName, handler);
      }
    }
  }

  coerceArgs(
    tool: ToolName,
    rawArgs: Record<string, unknown>,
    ctx: CoerceContext,
  ): Record<string, unknown> | null {
    const handler = this.coerceHandlers.get(tool);
    if (!handler) {
      return { ...rawArgs };
    }
    return handler(rawArgs, ctx);
  }

  recover(
    tool: ToolName,
    text: string,
    ctx: RecoverContext,
  ): ToolCall | null {
    const handler = this.recoverHandlers.get(tool);
    if (!handler) {
      return null;
    }
    return handler(text, ctx);
  }
}

let defaultRegistry: ToolCallRepairRegistry | null = null;

export function getDefaultToolCallRepairRegistry(): ToolCallRepairRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolCallRepairRegistry();
  }
  return defaultRegistry;
}
