/**
 * Responsibility: preserve the existing core board-schema entry for callers.
 * Input/output: the contract-owned strict inert board shape and identical schema.
 * Configuration I/O, default merging, composition support and runtime state are
 * outside this compatibility facade; consumers migrate before C44 removal.
 * It never reads configuration files, applies defaults or executes rules.
 */
export { boardConfigSchema } from "@ai-werewolf-arena/game-contract";
