import type { RoleComponent } from "../../../core/domain/components/role";
import type { RoleCatalog } from "./catalog";
/** Query effective native permission at both validation and commit time. */
export function canRoleSelfDestruct(role: RoleComponent, catalog: RoleCatalog): boolean {
  const capability = catalog.get(role.role)?.canSelfDestruct;
  return typeof capability === "function" ? capability(role) : capability === true;
}
