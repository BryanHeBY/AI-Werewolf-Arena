import { COMPONENT } from "./components/names";
import { aliveLifeVersion, type AliveComponent } from "./components/alive";
import type { World } from "./world";
import type { EntityId } from "./identity";

/** Runtime-only ownership. Component references never enter events or recordings. */
export interface NightLifeScope { readonly id: EntityId; readonly life: AliveComponent; readonly version: number }
export interface NightPoisonClaim { readonly source: NightLifeScope; readonly target: NightLifeScope }
export function captureNightLife(world: World, id: EntityId): NightLifeScope | null {
  const life = world.getComponent<AliveComponent>(id, COMPONENT.Alive), version = life && aliveLifeVersion(life);
  return life?.alive && version !== undefined ? { id, life, version } : null;
}
export function sameNightLife(world: World, scope: NightLifeScope): boolean {
  return world.getComponent(scope.id, COMPONENT.Alive) === scope.life && aliveLifeVersion(scope.life) === scope.version;
}
export function livingNightLife(world: World, scope: NightLifeScope): boolean {
  return sameNightLife(world, scope) && scope.life.alive;
}
