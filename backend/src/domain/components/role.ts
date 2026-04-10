import { Camp, EntityId, PromptRenderable, Role } from "../model";

/**
 * 女巫私有状态。
 */
export interface WitchState {
  heal: number;
  poison: number;
  canSelfHeal: boolean;
  healUsedThisNight: boolean;
  poisonUsedThisNight: boolean;
}

/**
 * 守卫私有状态。
 */
export interface GuardState {
  lastTarget: EntityId | null;
}

/**
 * 猎人私有状态。
 */
export interface HunterState {
  canShoot: boolean;
}

/**
 * 白痴私有状态。
 */
export interface IdiotState {
  revealed: boolean;
}

/**
 * 预言家私有状态。
 */
export interface SeerState {
  lastTarget: EntityId | null;
  lastIsWerewolf: boolean | null;
  history: Array<{
    targetId: EntityId;
    isWerewolf: boolean;
  }>;
}

/**
 * 角色组件：统一记录底牌与角色私有状态。
 */
export interface RoleComponent extends PromptRenderable {
  role: Role;
  camp: Camp;
  witchState?: WitchState;
  guardState?: GuardState;
  hunterState?: HunterState;
  idiotState?: IdiotState;
  seerState?: SeerState;
}

/**
 * 角色组件工厂：
 * 根据底牌初始化角色私有状态（如女巫药量、守卫上轮守护目标等）。
 */
export function inferCamp(role: Role): Camp {
  if (role === Role.Wolf) {
    return Camp.Wolf;
  }
  return Camp.Good;
}

/**
 * 创建角色组件并按角色初始化私有状态。
 */
export function createRoleComponent(role: Role): RoleComponent {
  return {
    role,
    camp: inferCamp(role),
    renderPrompt(): string {
      return `你的底牌是【${this.role}】。`;
    },
  };
}
