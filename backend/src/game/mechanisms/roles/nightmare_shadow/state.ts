/**
 * Owns Nightmare Shadow private-state data and its existing field checks. Inputs are the
 * original role state and candidate context; outputs are fresh state, current fear targets and
 * readable state references. This state helper does not execute a fear stage or serialize
 * runtime authority.
 */
import { types } from "node:util";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, type EntityId } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";

export const NIGHTMARE_SHADOW_ROLE = "nightmare" as const;
export const NIGHTMARE_SHADOW_POLICY = "awa_nightmare_dreamer_v1" as const;
export type FearActionPolicy = "optional" | "required_when_legal";
export type NightmareWolfActionPolicy = "standard" | "no_blast_no_self_knife";
export interface NightmareShadowState {
  policy: typeof NIGHTMARE_SHADOW_POLICY;
  fearActionPolicy: FearActionPolicy;
  wolfActionPolicy: NightmareWolfActionPolicy;
  packReady: boolean;
  lastDay: number | null;
  lastTarget: EntityId | null;
  history: { day: number; targetId: EntityId | null }[];
}
function data(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
export function freshNightmareShadowState(
  fearActionPolicy: FearActionPolicy = "optional",
  wolfActionPolicy: NightmareWolfActionPolicy = "standard",
): NightmareShadowState {
  return {
    policy: NIGHTMARE_SHADOW_POLICY,
    fearActionPolicy,
    wolfActionPolicy,
    packReady: false,
    lastDay: null,
    lastTarget: null,
    history: [],
  };
}
function validId(value: unknown): value is EntityId {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function validDay(value: unknown): value is number {
  return validId(value);
}
export function getNightmareShadowState(
  role: RoleComponent | undefined,
): NightmareShadowState | undefined {
  if (data(role, "role") !== NIGHTMARE_SHADOW_ROLE || data(role, "camp") !== Camp.Wolf)
    return undefined;
  const state = data(data(role, "privateState"), "nightmareShadow");
  const fear = data(state, "fearActionPolicy"),
    wolf = data(state, "wolfActionPolicy");
  const day = data(state, "lastDay"),
    target = data(state, "lastTarget");
  const history = data(state, "history"),
    ready = data(state, "packReady");
  if (
    data(state, "policy") !== NIGHTMARE_SHADOW_POLICY ||
    (fear !== "optional" && fear !== "required_when_legal") ||
    (wolf !== "standard" && wolf !== "no_blast_no_self_knife") ||
    typeof ready !== "boolean" ||
    (day !== null && !validDay(day)) ||
    (target !== null && !validId(target)) ||
    (history !== null && typeof history === "object" && types.isProxy(history)) ||
    !Array.isArray(history)
  )
    return undefined;
  const length = data(history, "length");
  if (typeof length !== "number") return undefined;
  if (day === null)
    return !ready && target === null && length === 0 ? (state as NightmareShadowState) : undefined;
  if (!ready || length === 0) return undefined;
  let previous = 0;
  for (let i = 0; i < length; i++) {
    const entry = data(history, String(i));
    const entryDay = data(entry, "day"),
      entryTarget = data(entry, "targetId");
    if (
      !validDay(entryDay) ||
      entryDay <= previous ||
      (entryTarget !== null && !validId(entryTarget))
    )
      return undefined;
    previous = entryDay;
    if (i === length - 1 && (entryDay !== day || entryTarget !== target)) return undefined;
  }
  return state as NightmareShadowState;
}
/** The same target policy must feed requests, validation, baselines and hints. */
export function nightmareFearTargets(world: World, actorId: EntityId, day: number): EntityId[] {
  const state = getNightmareShadowState(world.getComponent(actorId, COMPONENT.Role));
  if (
    !state ||
    !validDay(day) ||
    !world.getAliveEntityIds().includes(actorId) ||
    (day > 1 && !state.packReady) ||
    (state.lastDay !== null && day <= state.lastDay)
  )
    return [];
  return world.getAliveEntityIds().filter((id) => {
    if (id === actorId || (state.lastDay === day - 1 && state.lastTarget === id)) return false;
    const target = world.getComponent(id, COMPONENT.Role);
    return !!target && (!state.packReady || target.camp !== Camp.Wolf);
  });
}
