import { COMPONENT } from "../../domain/components/names";
import { inferCamp } from "../../domain/components/role";
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
    return roleComp?.camp === Camp.Wolf;
  }

  isWolfAudience(identity: AudienceIdentity): boolean {
    if (identity.camp === Camp.Wolf || identity.camp === Camp.Wolf.toString()) {
      return true;
    }
    if (typeof identity.role !== "string") {
      return false;
    }
    if (!this.isRole(identity.role)) {
      return false;
    }
    return inferCamp(identity.role) === Camp.Wolf;
  }

  private isRole(role: string): role is Role {
    return (Object.values(Role) as string[]).includes(role);
  }
}

let defaultRegistry: VisibilityRegistry | null = null;

export function getDefaultVisibilityRegistry(): VisibilityRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new VisibilityRegistry();
  }
  return defaultRegistry;
}
