/** 文件说明：角色到前端展示视图的转换逻辑。 */
import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { Camp, Role } from "../../domain/model";
import { World } from "../../domain/world";
import { getWitchState } from "./private_state";

const FRONTEND_ROLE_TYPE: Record<Role, string> = {
  [Role.Wolf]: "wolf",
  [Role.Villager]: "villager",
  [Role.Seer]: "seer",
  [Role.Guard]: "guard",
  [Role.Witch]: "witch",
  [Role.Hunter]: "hunter",
  [Role.Idiot]: "idiot",
};

/** 角色视图转换注册表。 */
export class RoleViewRegistry {
  toFrontendRoleType(role: Role | undefined): string {
    if (!role) {
      return "villager";
    }
    return FRONTEND_ROLE_TYPE[role] ?? "villager";
  }

  toFrontendFaction(camp: Camp | null): "wolf" | "villager" {
    return camp === Camp.Wolf ? "wolf" : "villager";
  }

  getWitchResourceState(world: World): {
    hasAntidote: boolean;
    hasPoison: boolean;
  } {
    const witch = world
      .entityIds()
      .map((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role))
      .find((roleComp) => roleComp?.role === Role.Witch);
    const witchState = witch ? getWitchState(witch) : undefined;
    return {
      hasAntidote: (witchState?.heal ?? 0) > 0,
      hasPoison: (witchState?.poison ?? 0) > 0,
    };
  }
}

let defaultRegistry: RoleViewRegistry | null = null;

/** 获取默认角色视图转换注册表实例。 */
export function getDefaultRoleViewRegistry(): RoleViewRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RoleViewRegistry();
  }
  return defaultRegistry;
}
