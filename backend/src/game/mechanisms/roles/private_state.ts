/**
 * Named compatibility exports for feature-owned role state shapes and accessors.
 * Inputs and outputs retain the original private-state slots or ability-owned references.
 * No state is stored here; each feature leaf owns its data and native installation access.
 * Existing commands, lease checks, inventory, projection and checkpoint encoding remain
 * their current owners until those separate migrations; this facade exits in C44.
 */
export type { SeerState } from "./seer/state-contracts";
export { getSeerState, setSeerState } from "./seer/state";
export type { WitchState } from "./witch/state";
export { getWitchState, setWitchState } from "./witch/state";
export type { GuardState } from "./guard/state";
export { getGuardState, setGuardState } from "./guard/state";
export type { DreamerState } from "./dreamer/state";
export { getDreamerState, setDreamerState } from "./dreamer/state";
export type { RoleInspectionState } from "./role_inspection/state";
export { getRoleInspectionState, setRoleInspectionState } from "./role_inspection/state";
export type { HunterState } from "./hunter/state";
export { getHunterState, setHunterState } from "./hunter/state";
export type { WolfKingState } from "./wolf_king/state";
export { getWolfKingState, setWolfKingState } from "./wolf_king/state";
export type { WhiteWolfKingState } from "./white_wolf_king/state";
export { getWhiteWolfKingState, setWhiteWolfKingState } from "./white_wolf_king/state";
export type { KnightState } from "./knight/state";
export { getKnightState, setKnightState } from "./knight/state";
export type { GravekeeperReport, GravekeeperState } from "./gravekeeper/state";
export { getGravekeeperState, setGravekeeperState } from "./gravekeeper/state";
export type { WolfBeautyState } from "./wolf_beauty/state";
export { getWolfBeautyState, setWolfBeautyState } from "./wolf_beauty/state";
export type { BearState } from "./bear/state";
export { getBearState, setBearState } from "./bear/state";
export type { HiddenWolfState } from "./hidden_wolf/state";
export { getHiddenWolfState, setHiddenWolfState } from "./hidden_wolf/state";
export type { GargoyleState } from "./gargoyle/state";
export { getGargoyleState, setGargoyleState } from "./gargoyle/state";
export type { IdiotState } from "./idiot/state";
export { getIdiotState, setIdiotState } from "./idiot/state";
