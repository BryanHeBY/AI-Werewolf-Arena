/**
 * Compatibility identity exit for existing core/domain, engine and agent callers.
 * Inputs are the game-contract-owned machine identities; outputs re-export the
 * same enum objects and types without a second ID declaration or transformation.
 * PromptRenderable remains a presentation compatibility type until its consumers
 * migrate; no role execution, state mutation or text is implemented here.
 */
import type { Locale } from "@ai-werewolf-arena/game-contract";
export {
  Camp,
  Role,
  Phase,
  ActionWindow,
  KnightDuelWindow,
  StatusMark,
  WinCondition,
  PotionType,
  WitchSelfHealRule,
} from "@ai-werewolf-arena/game-contract";
export type { EntityId, TieBreakerStrategy } from "@ai-werewolf-arena/game-contract";

export interface PromptRenderable {
  renderPrompt(locale?: Locale): string;
}
