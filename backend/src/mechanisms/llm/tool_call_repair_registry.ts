import { ToolCall, ToolName } from "../../domain/model";
import { COMMON_LLM_REPAIR_PACK } from "../common/llm_repair";
import { GUARD_LLM_REPAIR_PACK } from "../roles/guard/llm_repair";
import { HUNTER_LLM_REPAIR_PACK } from "../roles/hunter/llm_repair";
import { SEER_LLM_REPAIR_PACK } from "../roles/seer/llm_repair";
import { WITCH_LLM_REPAIR_PACK } from "../roles/witch/llm_repair";
import { WOLF_LLM_REPAIR_PACK } from "../roles/wolf/llm_repair";
import { SHERIFF_LLM_REPAIR_PACK } from "../sheriff/llm_repair";
import { CoerceContext, RecoverContext, ToolRepairPack } from "./contracts";

const DEFAULT_PACKS: ToolRepairPack[] = [
  COMMON_LLM_REPAIR_PACK,
  WOLF_LLM_REPAIR_PACK,
  GUARD_LLM_REPAIR_PACK,
  SEER_LLM_REPAIR_PACK,
  WITCH_LLM_REPAIR_PACK,
  HUNTER_LLM_REPAIR_PACK,
  SHERIFF_LLM_REPAIR_PACK,
];

export class ToolCallRepairRegistry {
  private readonly coerceHandlers = new Map<ToolName, ToolRepairPack["coerce"][ToolName]>();
  private readonly recoverHandlers = new Map<ToolName, ToolRepairPack["recover"][ToolName]>();

  constructor(packs: ToolRepairPack[] = DEFAULT_PACKS) {
    for (const pack of packs) {
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
