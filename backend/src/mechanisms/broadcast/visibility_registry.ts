import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { Camp, EntityId, Role } from "../../domain/model";
import { World } from "../../domain/world";

export interface AudienceIdentity {
  role?: string;
  camp?: Camp | string;
}

export class VisibilityRegistry {
  isWolfPlayer(world: World, actorId: EntityId): boolean {
    const roleComp = world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
    return roleComp?.camp === Camp.Wolf || roleComp?.role === Role.Wolf;
  }

  isWolfAudience(identity: AudienceIdentity): boolean {
    if (identity.camp === Camp.Wolf || identity.camp === Camp.Wolf.toString()) {
      return true;
    }
    return identity.role === Role.Wolf || identity.role === Role.Wolf.toString();
  }
}

let defaultRegistry: VisibilityRegistry | null = null;

export function getDefaultVisibilityRegistry(): VisibilityRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new VisibilityRegistry();
  }
  return defaultRegistry;
}
