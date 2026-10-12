/**
 * Exposes the Knight's readonly native-state view to the daytime duel window.
 * Inputs are current role components before eligibility and commit rechecks;
 * outputs are the original stored reference, never a copied resource snapshot.
 * The window may read identity and availability; only the Knight commit consumes
 * stock. Replacement and terminal window failures remain the window owner's checks.
 */
export { getKnightState } from "./state";
export type { KnightState } from "./state";
