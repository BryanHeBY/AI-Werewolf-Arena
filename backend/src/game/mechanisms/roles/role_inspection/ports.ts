/**
 * Exposes role-inspection native state access to profiles that contribute this ability.
 * Inputs are role components during installation or before a current-state read.
 * Consumers are native profiles, Pure White and the compatibility facade; outputs are the
 * owning read-only state functions, concrete ordered writer and types, with their existing native-first stored identity.
 * This public port does not authorize an inspection, grant stock, execute stages
 * or encode archives; lease owners retain expiration and terminal failure checks.
 * All implementation stays in the role-inspection feature.
 */
export {
  getRoleInspectionState,
  setRoleInspectionState,
  recordAbilityRoleInspection,
} from "./state";
