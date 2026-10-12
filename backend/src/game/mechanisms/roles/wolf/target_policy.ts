/**
 * Checks the wolf knife target policy from current roles and pack membership. Inputs are World,
 * actor and target IDs; output is the existing allowed-target predicate. It does not reveal
 * hidden teammate knowledge or commit the knife vote.
 */
import { readNobleState } from "../noble_secret_body/state";
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
    (world.getComponent(id, COMPONENT.Role)?.role !== Role.NightNoble ||
      readNobleState(world.getComponent(id, COMPONENT.Role)?.privateState.noble)
        ?.wolfActionPolicy === "standard") &&
    world.getAliveEntityIds().includes(id) &&
    world.getComponent(id, COMPONENT.Role)?.role !== Role.EvilKnight &&
    (world.getComponent(id, COMPONENT.Role)?.role !== Role.NightmareShadow ||
      getNightmareShadowState(world.getComponent(id, COMPONENT.Role))?.wolfActionPolicy ===
        "standard")
  );
}
