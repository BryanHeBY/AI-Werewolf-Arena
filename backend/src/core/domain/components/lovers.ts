/**
 * Responsibility: preserve the Cupid ECS metadata type for existing domain callers.
 * Input/output: the contract-owned God-only LoversComponent shape; actual component
 * storage and relation writes remain domain-owned. No runtime handle is serialized.
 */
export type { LoversComponent } from "@ai-werewolf-arena/game-contract";
