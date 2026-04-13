/** 文件说明：聚合所有角色与机制的 LLM 修复规则。 */
import { ToolCall, ToolName } from "../../../domain/model";
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

/** LLM 工具调用修复注册表。 */
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

/** 获取默认 LLM 工具调用修复注册表实例。 */
export function getDefaultToolCallRepairRegistry(): ToolCallRepairRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolCallRepairRegistry();
  }
  return defaultRegistry;
}
