/**
 * Exposes White Wolf King's readonly native state and concrete consumption command.
 * Inputs are original roles or the already validated captured resource; output
 * keeps the stored reference. The window reads eligibility before commitment;
 * only the selected blast commit writes stock, without changing phase or deaths.
 * Invalid or expired windows remain their owner's terminal checks, not this port.
 */
export { getWhiteWolfKingState, consumeWhiteWolfDetonation } from "./state";
export type { WhiteWolfKingState } from "./state";
