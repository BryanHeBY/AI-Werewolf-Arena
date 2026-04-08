import { Camp, EntityId, PromptRenderable, Role } from "../model";

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

export function createRoleComponent(role: Role): RoleComponent {
  const camp = inferCamp(role);
  const base: Omit<RoleComponent, "renderPrompt"> = {
    role,
    camp,
  };

  if (role === Role.Witch) {
    base.witchState = {
      heal: 1,
      poison: 1,
      canSelfHeal: false,
      healUsedThisNight: false,
      poisonUsedThisNight: false,
    };
  }

  if (role === Role.Guard) {
    base.guardState = {
      lastTarget: null,
    };
  }

  if (role === Role.Hunter) {
    base.hunterState = {
      canShoot: true,
    };
  }

  if (role === Role.Idiot) {
    base.idiotState = {
      revealed: false,
    };
  }

  if (role === Role.Seer) {
    base.seerState = {
      lastTarget: null,
      lastIsWerewolf: null,
      history: [],
    };
  }

  return {
    ...base,
    renderPrompt(): string {
      // 这里输出给模型的“角色设定片段”，用于 PromptAssembler 拼装系统事实区。
      if (this.role === Role.Witch && this.witchState) {
        return `你的底牌是【女巫】。解药:${this.witchState.heal} 毒药:${this.witchState.poison}`;
      }
      if (this.role === Role.Guard) {
        return "你的底牌是【守卫】。你每晚可以守护一名玩家，且不可连续同守。";
      }
      if (this.role === Role.Seer) {
        const seerState = this.seerState;
        const latest =
          seerState &&
          seerState.lastTarget !== null &&
          seerState.lastIsWerewolf !== null
            ? ` 你上一条查验结果：${seerState.lastTarget}号是${seerState.lastIsWerewolf ? "狼人" : "好人"}。`
            : "";
        return `你的底牌是【预言家】。你每晚可以查验一名玩家阵营。${latest}`;
      }
      if (this.role === Role.Hunter) {
        return "你的底牌是【猎人】。满足条件时你可以开枪带走一名玩家。";
      }
      if (this.role === Role.Idiot) {
        return "你的底牌是【白痴】。白天被放逐后可翻牌免死并失去投票权。";
      }
      if (this.role === Role.Wolf) {
        return "你的底牌是【狼人】。你可以参与夜间战术交流和刀人投票。";
      }
      return "你的底牌是【平民】。你没有夜间技能。";
    },
  };
}
