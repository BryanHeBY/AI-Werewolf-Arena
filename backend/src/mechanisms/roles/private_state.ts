import { EntityId } from "../../domain/model";
import { RoleComponent } from "../../domain/components/role";

const PRIVATE_STATE_KEYS = {
  witch: "witch",
  guard: "guard",
  hunter: "hunter",
  idiot: "idiot",
  seer: "seer",
} as const;

export interface WitchState {
  heal: number;
  poison: number;
  canSelfHeal: boolean;
  healUsedThisNight: boolean;
  poisonUsedThisNight: boolean;
}

export interface GuardState {
  lastTarget: EntityId | null;
}

export interface HunterState {
  canShoot: boolean;
}

export interface IdiotState {
  revealed: boolean;
}

export interface SeerState {
  lastTarget: EntityId | null;
  lastIsWerewolf: boolean | null;
  history: Array<{
    targetId: EntityId;
    isWerewolf: boolean;
  }>;
}

function getState<T>(roleComp: RoleComponent, key: string): T | undefined {
  return roleComp.privateState[key] as T | undefined;
}

function setState<T>(roleComp: RoleComponent, key: string, value: T): T {
  roleComp.privateState[key] = value as unknown;
  return value;
}

export function setWitchState(roleComp: RoleComponent, state: WitchState): WitchState {
  return setState(roleComp, PRIVATE_STATE_KEYS.witch, state);
}

export function getWitchState(roleComp: RoleComponent): WitchState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.witch);
}

export function setGuardState(roleComp: RoleComponent, state: GuardState): GuardState {
  return setState(roleComp, PRIVATE_STATE_KEYS.guard, state);
}

export function getGuardState(roleComp: RoleComponent): GuardState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.guard);
}

export function setHunterState(roleComp: RoleComponent, state: HunterState): HunterState {
  return setState(roleComp, PRIVATE_STATE_KEYS.hunter, state);
}

export function getHunterState(roleComp: RoleComponent): HunterState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.hunter);
}

export function setIdiotState(roleComp: RoleComponent, state: IdiotState): IdiotState {
  return setState(roleComp, PRIVATE_STATE_KEYS.idiot, state);
}

export function getIdiotState(roleComp: RoleComponent): IdiotState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.idiot);
}

export function setSeerState(roleComp: RoleComponent, state: SeerState): SeerState {
  return setState(roleComp, PRIVATE_STATE_KEYS.seer, state);
}

export function getSeerState(roleComp: RoleComponent): SeerState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.seer);
}
