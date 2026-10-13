/**
 * Named compatibility exports for feature-owned role state shapes and accessors.
 * Inputs and outputs retain the original private-state slots or ability-owned references.
 * No state is stored here; each feature leaf owns its data and native installation access.
 * Existing commands, lease checks, inventory, projection and checkpoint encoding remain
 * their current owners until those separate migrations; this facade exits in C44.
 */

export { getSeerState, setSeerState } from "./seer/state";
export { getWitchState, setWitchState } from "./witch/state";
export { getGuardState, setGuardState } from "./guard/state";
export { getDreamerState, setDreamerState } from "./dreamer/state";
export { getRoleInspectionState, setRoleInspectionState } from "./role_inspection/state";
export { getHunterState, setHunterState } from "./hunter/state";
export { getWolfKingState, setWolfKingState } from "./wolf_king/state";
export { getWhiteWolfKingState, setWhiteWolfKingState } from "./white_wolf_king/state";
export { getKnightState, setKnightState } from "./knight/state";
export { getGravekeeperState, setGravekeeperState } from "./gravekeeper/state";
export { getWolfBeautyState, setWolfBeautyState } from "./wolf_beauty/state";
export { getBearState, setBearState } from "./bear/state";
export { getHiddenWolfState, setHiddenWolfState } from "./hidden_wolf/state";
export { getGargoyleState, setGargoyleState } from "./gargoyle/state";
export { getIdiotState, setIdiotState } from "./idiot/state";
