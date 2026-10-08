import type { InspectionKind, InspectionResult } from "@ai-werewolf-arena/game-catalog";
import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { EntityId } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { RoleCatalog } from "./catalog";

/** Read-only rule projection. Calling this helper is not an action authorization. */
export function resolveInspection<K extends InspectionKind>(world: World, targetId: EntityId, kind: K, catalog: RoleCatalog): Extract<InspectionResult, { kind: K }> | null {
  const target = world.getComponent<RoleComponent>(targetId, COMPONENT.Role);
  if (!target) return null;
  const definition = catalog.get(target.role)?.inspectionLabels;
  const labels = typeof definition === "function" ? definition(target) : definition;
  const camp = labels?.camp ?? target.camp, role = labels?.role ?? target.role;
  const result: InspectionResult = kind === "camp" ? { kind, camp } : kind === "role" ? { kind, role } : { kind, camp, role };
  return result as Extract<InspectionResult, { kind: K }>;
}
