/**
 * Exposes Guard native-state reads and ordinary target-write commands.
 * Inputs are existing roles or captured recipient instances at validated commit;
 * outputs preserve the same slot and original state-before-target read order.
 * Caller permissions, stock/use accounting and terminal failures stay outside
 * these commands; no leased protection or checkpoint is created here.
 */
export { getGuardState, recordGuardTarget, recordRecipientGuardTarget } from "./state";
export type { GuardState } from "./state";
