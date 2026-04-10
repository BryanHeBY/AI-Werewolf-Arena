/** 文件说明：角色私有状态的统一读写封装。 */
import { EntityId } from "../../domain/model";
import { RoleComponent } from "../../domain/components/role";

const PRIVATE_STATE_KEYS = {
  witch: "witch",
  guard: "guard",
  hunter: "hunter",
  idiot: "idiot",
  seer: "seer",
} as const;

/** 女巫私有状态。 */
export interface WitchState {
  heal: number;
  poison: number;
  canSelfHeal: boolean;
  healUsedThisNight: boolean;
  poisonUsedThisNight: boolean;
}

/** 守卫私有状态。 */
export interface GuardState {
  lastTarget: EntityId | null;
}

/** 猎人私有状态。 */
export interface HunterState {
  canShoot: boolean;
}

/** 白痴私有状态。 */
export interface IdiotState {
  revealed: boolean;
}

/** 预言家私有状态。 */
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

/** 写入女巫私有状态。 */
export function setWitchState(roleComp: RoleComponent, state: WitchState): WitchState {
  return setState(roleComp, PRIVATE_STATE_KEYS.witch, state);
}

/** 读取女巫私有状态。 */
export function getWitchState(roleComp: RoleComponent): WitchState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.witch);
}

/** 写入守卫私有状态。 */
export function setGuardState(roleComp: RoleComponent, state: GuardState): GuardState {
  return setState(roleComp, PRIVATE_STATE_KEYS.guard, state);
}

/** 读取守卫私有状态。 */
export function getGuardState(roleComp: RoleComponent): GuardState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.guard);
}

/** 写入猎人私有状态。 */
export function setHunterState(roleComp: RoleComponent, state: HunterState): HunterState {
  return setState(roleComp, PRIVATE_STATE_KEYS.hunter, state);
}

/** 读取猎人私有状态。 */
export function getHunterState(roleComp: RoleComponent): HunterState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.hunter);
}

/** 写入白痴私有状态。 */
export function setIdiotState(roleComp: RoleComponent, state: IdiotState): IdiotState {
  return setState(roleComp, PRIVATE_STATE_KEYS.idiot, state);
}

/** 读取白痴私有状态。 */
export function getIdiotState(roleComp: RoleComponent): IdiotState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.idiot);
}

/** 写入预言家私有状态。 */
export function setSeerState(roleComp: RoleComponent, state: SeerState): SeerState {
  return setState(roleComp, PRIVATE_STATE_KEYS.seer, state);
}

/** 读取预言家私有状态。 */
export function getSeerState(roleComp: RoleComponent): SeerState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.seer);
}
