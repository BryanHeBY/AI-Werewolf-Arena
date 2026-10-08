/** 文件说明：角色私有状态的统一读写封装。 */
import { EntityId, WitchSelfHealRule } from "../../../core/domain/model";
import { RoleComponent } from "../../../core/domain/components/role";
import type { InspectionResult } from "@ai-werewolf-arena/game-catalog";
import type { ExileFeedback } from "../../../core/domain/events";
import { findNightAbility, installNativeAbility } from "./abilities";

const PRIVATE_STATE_KEYS = {
  witch: "witch",
  guard: "guard",
  hunter: "hunter",
  wolfKing: "wolf_king",
  whiteWolfKing: "white_wolf_king",
  knight: "knight",
  gravekeeper: "gravekeeper",
  wolfBeauty: "wolf_beauty",
  idiot: "idiot",
  seer: "seer",
} as const;

/** 女巫私有状态。 */
export interface WitchState {
  heal: number;
  poison: number;
  selfHealRule: WitchSelfHealRule;
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
export interface WolfKingState { canShoot: boolean }
export interface WhiteWolfKingState { canDetonate: boolean }
export interface KnightState { canDuel: boolean }
export interface GravekeeperReport extends ExileFeedback { receivedDay: number }
export interface GravekeeperState { history: GravekeeperReport[] }
export interface DreamerState { lastTarget: EntityId | null; lastDay: number | null; history: Array<{day: number; targetId: EntityId}> }
export interface WolfBeautyState { targetId: EntityId | null; lastActedDay: number | null; history: Array<{day:number;targetId:EntityId|null}> }

/** 白痴私有状态。 */
export interface IdiotState {
  revealed: boolean;
}

/** 预言家私有状态。 */
export interface SeerState {
  lastTarget: EntityId | null;
  lastIsWerewolf: boolean | null;
  lastResult?: InspectionResult | null;
  history: Array<{
    targetId: EntityId;
    isWerewolf: boolean;
    result?: InspectionResult;
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
  return installNativeAbility(roleComp, "potion", state);
}

/** 读取女巫私有状态。 */
export function getWitchState(roleComp: RoleComponent, abilityId?: string): WitchState | undefined {
  return findNightAbility(roleComp, "potion", abilityId)?.state;
}

/** 写入守卫私有状态。 */
export function setGuardState(roleComp: RoleComponent, state: GuardState): GuardState {
  return installNativeAbility(roleComp, "guard", state);
}

/** 读取守卫私有状态。 */
export function getGuardState(roleComp: RoleComponent, abilityId?: string): GuardState | undefined {
  return findNightAbility(roleComp, "guard", abilityId)?.state;
}

/** 写入猎人私有状态。 */
export function setHunterState(roleComp: RoleComponent, state: HunterState): HunterState {
  return setState(roleComp, PRIVATE_STATE_KEYS.hunter, state);
}

/** 读取猎人私有状态。 */
export function getHunterState(roleComp: RoleComponent): HunterState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.hunter);
}
export function setWolfKingState(roleComp: RoleComponent, state: WolfKingState): WolfKingState {
  return setState(roleComp, PRIVATE_STATE_KEYS.wolfKing, state);
}
export function getWolfKingState(roleComp: RoleComponent): WolfKingState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.wolfKing);
}
export function setWhiteWolfKingState(roleComp: RoleComponent, state: WhiteWolfKingState): WhiteWolfKingState {
  return setState(roleComp, PRIVATE_STATE_KEYS.whiteWolfKing, state);
}
export function getWhiteWolfKingState(roleComp: RoleComponent): WhiteWolfKingState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.whiteWolfKing);
}
export function setKnightState(roleComp: RoleComponent, state: KnightState): KnightState {
  return setState(roleComp, PRIVATE_STATE_KEYS.knight, state);
}
export function getKnightState(roleComp: RoleComponent): KnightState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.knight);
}
export function setGravekeeperState(roleComp: RoleComponent, state: GravekeeperState): GravekeeperState {
  return setState(roleComp, PRIVATE_STATE_KEYS.gravekeeper, state);
}
export function getGravekeeperState(roleComp: RoleComponent): GravekeeperState | undefined {
  return getState(roleComp, PRIVATE_STATE_KEYS.gravekeeper);
}
export function setDreamerState(roleComp: RoleComponent, state: DreamerState): DreamerState { return installNativeAbility(roleComp, "dream", state); }
export function getDreamerState(roleComp: RoleComponent, abilityId?: string): DreamerState | undefined { return findNightAbility(roleComp, "dream", abilityId)?.state; }
export function setWolfBeautyState(roleComp: RoleComponent, state: WolfBeautyState): WolfBeautyState { return setState(roleComp,PRIVATE_STATE_KEYS.wolfBeauty,state); }
export function getWolfBeautyState(roleComp: RoleComponent): WolfBeautyState | undefined { return getState(roleComp,PRIVATE_STATE_KEYS.wolfBeauty); }

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
  return installNativeAbility(roleComp, "seer_check", state);
}

/** 读取预言家私有状态。 */
export function getSeerState(roleComp: RoleComponent, abilityId?: string): SeerState | undefined {
  return findNightAbility(roleComp, "seer_check", abilityId)?.state;
}
