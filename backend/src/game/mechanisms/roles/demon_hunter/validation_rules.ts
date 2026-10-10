import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { canSubmitDemonHunt } from "./authority";
import type { ToolRule } from "../../validation/contracts";
/** Registered only by the explicit candidate profile until full catalog delivery. */
export const DEMON_HUNTER_TOOL_RULE: ToolRule = ({
  world,
  actorId,
  phase,
  day,
  demonHunterScope,
  toolCall,
}) =>
  canSubmitDemonHunt(world, actorId, phase, day ?? 0, demonHunterScope, toolCall)
    ? null
    : { code: RuleError.ToolMismatch };
