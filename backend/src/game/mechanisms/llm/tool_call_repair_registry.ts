/**
 * 负责聚合通用、警长与角色运行贡献的参数修复规则。输入为原修复包及回合上下文；
 * 输出为原 coercion 结果或原参数副本。注册保持顺序和最后处理函数引用；
 * 本索引不接受动作、消耗库存或授予当前请求权限。
 */
import { ToolName } from "../../../domain/model";
import { COMMON_LLM_REPAIR_PACK } from "../common/llm_repair";
import { RoleCatalog } from "../roles/catalog";
import { getDefaultRoleCatalog } from "../roles/role-catalog-assembly";
import { SHERIFF_LLM_REPAIR_PACK } from "../sheriff/llm_repair";
import { CoerceContext, ToolRepairPack } from "./contracts";

function buildDefaultPacks(roleProfileRegistry: RoleCatalog): ToolRepairPack[] {
  const packs: ToolRepairPack[] = [COMMON_LLM_REPAIR_PACK, SHERIFF_LLM_REPAIR_PACK];
  for (const { runtime: profile } of roleProfileRegistry.allRuntime()) {
    if (profile.llmRepair) {
      packs.push(profile.llmRepair);
    }
  }
  return packs;
}

/** LLM 工具调用修复注册表。 */
export class ToolCallRepairRegistry {
  private readonly coerceHandlers = new Map<ToolName, ToolRepairPack["coerce"][ToolName]>();

  constructor(
    packs?: ToolRepairPack[],
    roleProfileRegistry: RoleCatalog = getDefaultRoleCatalog(),
  ) {
    const effectivePacks = packs ?? buildDefaultPacks(roleProfileRegistry);
    for (const pack of effectivePacks) {
      for (const [name, handler] of Object.entries(pack.coerce)) {
        this.coerceHandlers.set(name as ToolName, handler);
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
}

let defaultRegistry: ToolCallRepairRegistry | null = null;

/** 获取默认 LLM 工具调用修复注册表实例。 */
export function getDefaultToolCallRepairRegistry(): ToolCallRepairRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolCallRepairRegistry();
  }
  return defaultRegistry;
}
