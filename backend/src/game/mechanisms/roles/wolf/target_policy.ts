import { getNightmareShadowState } from "../nightmare_shadow/state";
import { isMistRavenBoard, mistKnifeTargets } from "../mist_raven/night_frame";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Role, type EntityId } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
/** All ordinary pack knife entry points share the same target restriction. */
export function wolfKnifeTargetAllowed(world: World, id: EntityId): boolean {
  const circle = isMistRavenBoard(world) ? mistKnifeTargets(world) : null;
  return (
    (circle === null || circle.includes(id)) &&
    world.getAliveEntityIds().includes(id) &&
    world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role !== Role.EvilKnight &&
    (world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role !== Role.NightmareShadow ||
      getNightmareShadowState(world.getComponent<RoleComponent>(id, COMPONENT.Role))
        ?.wolfActionPolicy === "standard")
  );
}
