import { COMPONENT } from "./components/names";
import type { RoleComponent } from "./components/role";
import type { Role, Camp } from "./identity";
import type { World } from "./world";
const rosters = new WeakMap<World, ReadonlyMap<number, Readonly<{ role: Role; camp: Camp }>>>();
export function installInitialRoster(world: World): void {
  if (rosters.has(world)) throw new Error("initial_roster_already_installed");
  rosters.set(
    world,
    new Map(
      world.entityIds().map((id) => {
        const role = world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
        return [id, Object.freeze({ role: role.role, camp: role.camp })];
      }),
    ),
  );
}
export function initialPlayerIdentity(
  world: World,
  id: number,
): Readonly<{ role: Role; camp: Camp }> | undefined {
  return rosters.get(world)?.get(id);
}
