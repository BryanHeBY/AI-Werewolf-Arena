import { RoleRegistry } from "../../../core/domain/registries/role_registry";
import { COMMON_TOOL_SPECS } from "../common/tool_specs";
import { getDefaultRoleCatalog, type RoleCatalog } from "./catalog";

/** Tool permissions derive from profiles without a duplicate role/text view. */
export function createDefaultRoleRegistry(
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): RoleRegistry {
  const registry = new RoleRegistry();
  const commonTools = COMMON_TOOL_SPECS.map((spec) => spec.name);
  for (const profile of catalog.all()) {
    registry.registerAllowedTools(profile.role, [
      ...new Set([...commonTools, ...(profile.toolSpecs ?? []).map((spec) => spec.name)]),
    ]);
  }
  return registry;
}
