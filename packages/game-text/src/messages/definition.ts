/**
 * Defines the neutral structure of a translation owner's key/parameter table.
 * Input keys come only from game-contract's closed MessageKey authority;
 * output types bind each owner to its existing keys and named placeholders.
 * Every owned key has an array, including [] for parameterless templates.
 * This table owns translation metadata, never machine IDs, rules, user values,
 * or runtime MessageRef parameter rejection, which remains in the formatter.
 */
import type { MessageKey } from "@ai-werewolf-arena/game-contract";

export interface MessageDefinition {
  readonly owner: string;
  readonly parameters: Readonly<Partial<Record<MessageKey, readonly string[]>>>;
}
