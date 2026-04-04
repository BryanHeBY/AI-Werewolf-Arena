import {
  EntityId,
  IdentityComponent,
  StatusComponent,
  SkillComponent,
  Skill,
  GamePhase,
  RoleType,
  Faction,
} from "../../core/types";

/**
 * MechanicalWolf - 机械狼 ECS 组合
 *
 * 机械狼是 V2 架构的示范实体，展示如何通过组合组件创建复杂角色。
 * 特性：
 * 1. 拥有狼人身份，但额外机械特性
 * 2. 特殊技能：机械侦查、过载自爆
 * 3. 状态组件包含机械耐久度
 */

export interface MechanicalWolfIdentity extends IdentityComponent {
  roleType: RoleType.Wolf;
  faction: Faction.Wolf;
  name: string;
  model: string; // 机械型号
  serialNumber: string; // 序列号
}

export interface MechanicalWolfStatus extends StatusComponent {
  isAlive: boolean;
  isSheriff: boolean;
  isMuted: boolean;
  muteUntilRound?: number;
  durability: number; // 机械耐久度 (0-100)
  isOverloaded: boolean; // 是否过载
}

export interface MechanicalWolfSkills extends SkillComponent {
  skills: Skill[];
}

/**
 * 创建机械狼身份组件
 */
export function createMechanicalWolfIdentity(
  entityId: EntityId,
  name: string,
  model: string = "MK-III",
  serialNumber: string = `WOLF-${Date.now()}`,
): MechanicalWolfIdentity {
  return {
    entityId,
    roleType: RoleType.Wolf,
    faction: Faction.Wolf,
    name: `${name} (${model})`,
    model,
    serialNumber,
  };
}

/**
 * 创建机械狼状态组件
 */
export function createMechanicalWolfStatus(
  entityId: EntityId,
  durability: number = 100,
): MechanicalWolfStatus {
  return {
    entityId,
    isAlive: true,
    isSheriff: false,
    isMuted: false,
    durability,
    isOverloaded: false,
  };
}

/**
 * 机械侦查技能
 * 夜晚阶段可使用，侦查一名玩家是否为机械单位
 */
function createMechanicalScoutSkill(): Skill {
  return {
    skillId: "mechanical_scout",
    name: "机械侦查",
    cooldown: 0,
    canUseInPhase: [GamePhase.NightStart, GamePhase.WolfAction],
    execute: (entityId: EntityId, targetId?: EntityId) => {
      console.log(`机械狼 ${entityId} 对玩家 ${targetId} 使用机械侦查`);
      // TODO: 实现侦查逻辑，检查目标是否为机械单位
      // 返回侦查结果给玩家
    },
  };
}

/**
 * 过载自爆技能
 * 任何阶段可使用，自爆并造成范围伤害
 */
function createOverloadSelfDestructSkill(): Skill {
  return {
    skillId: "overload_self_destruct",
    name: "过载自爆",
    cooldown: 999, // 一次性技能
    canUseInPhase: Object.values(GamePhase), // 任何阶段都可使用
    execute: (entityId: EntityId, targetId?: EntityId) => {
      console.log(`机械狼 ${entityId} 发动过载自爆！`);
      // TODO: 实现自爆逻辑
      // 1. 标记自身死亡
      // 2. 对周围玩家造成伤害
      // 3. 触发游戏阶段变化（进入夜晚）
    },
  };
}

/**
 * 机械维修技能
 * 白天阶段可使用，恢复耐久度
 */
function createMechanicalRepairSkill(): Skill {
  return {
    skillId: "mechanical_repair",
    name: "机械维修",
    cooldown: 2,
    canUseInPhase: [GamePhase.DayStart, GamePhase.SequentialSpeech],
    execute: (entityId: EntityId) => {
      console.log(`机械狼 ${entityId} 进行机械维修，恢复耐久度`);
      // TODO: 实现维修逻辑，恢复耐久度
    },
  };
}

/**
 * 创建机械狼技能组件
 */
export function createMechanicalWolfSkills(
  entityId: EntityId,
): MechanicalWolfSkills {
  return {
    entityId,
    skills: [
      createMechanicalScoutSkill(),
      createOverloadSelfDestructSkill(),
      createMechanicalRepairSkill(),
    ],
  };
}

/**
 * 机械狼组件集合
 * 包含所有机械狼相关组件的引用
 */
export interface MechanicalWolfComponents {
  identity: MechanicalWolfIdentity;
  status: MechanicalWolfStatus;
  skills: MechanicalWolfSkills;
}

/**
 * 创建完整的机械狼实体组件集合
 */
export function createMechanicalWolf(
  entityId: EntityId,
  name: string,
  model?: string,
  serialNumber?: string,
): MechanicalWolfComponents {
  return {
    identity: createMechanicalWolfIdentity(entityId, name, model, serialNumber),
    status: createMechanicalWolfStatus(entityId),
    skills: createMechanicalWolfSkills(entityId),
  };
}

/**
 * 机械狼专用系统
 * 处理机械狼特有的逻辑
 */
export class MechanicalWolfSystem {
  update(phase: GamePhase, entities: EntityId[], world: any): void {
    // 查找所有机械狼实体
    const mechanicalWolves = entities.filter((entityId) => {
      const identity = world.getComponent(entityId, "IdentityComponent");
      return identity?.model?.startsWith("MK-"); // 机械狼型号以 MK- 开头
    });

    for (const wolfId of mechanicalWolves) {
      this.updateMechanicalWolf(wolfId, phase, world);
    }
  }

  private updateMechanicalWolf(
    entityId: EntityId,
    phase: GamePhase,
    world: any,
  ): void {
    const status = world.getComponent(
      entityId,
      "StatusComponent",
    ) as MechanicalWolfStatus;
    if (!status || !status.isAlive) return;

    // 根据阶段更新机械狼状态
    switch (phase) {
      case GamePhase.NightStart:
        this.handleNightStart(entityId, status, world);
        break;
      case GamePhase.DayStart:
        this.handleDayStart(entityId, status, world);
        break;
      case GamePhase.Self_Destruct:
        this.handleSelfDestruct(entityId, status, world);
        break;
    }

    // 更新耐久度衰减
    this.updateDurabilityDecay(entityId, status, world);
  }

  private handleNightStart(
    entityId: EntityId,
    status: MechanicalWolfStatus,
    world: any,
  ): void {
    // 夜晚开始，机械狼进入活跃模式
    console.log(`机械狼 ${entityId} 进入夜晚活跃模式`);
    // TODO: 增加夜间行动能力
  }

  private handleDayStart(
    entityId: EntityId,
    status: MechanicalWolfStatus,
    world: any,
  ): void {
    // 白天开始，机械狼进入节能模式
    console.log(`机械狼 ${entityId} 进入白天节能模式`);
    // TODO: 减少耐久度消耗
  }

  private handleSelfDestruct(
    entityId: EntityId,
    status: MechanicalWolfStatus,
    world: any,
  ): void {
    // 自爆阶段处理
    if (status.isOverloaded) {
      console.log(`机械狼 ${entityId} 因过载即将自爆`);
      // TODO: 执行自爆效果
      status.isAlive = false;
      status.durability = 0;

      // 广播自爆事件
      world.broadcastEvent?.({
        type: "MechanicalWolfSelfDestruct",
        entityId,
        damageRadius: 2,
      });
    }
  }

  private updateDurabilityDecay(
    entityId: EntityId,
    status: MechanicalWolfStatus,
    world: any,
  ): void {
    // 每回合耐久度自然衰减
    if (status.durability > 0) {
      status.durability = Math.max(0, status.durability - 1);

      if (status.durability <= 30 && !status.isOverloaded) {
        console.warn(`机械狼 ${entityId} 耐久度低于30%，可能随时过载！`);
      }

      if (status.durability <= 0) {
        status.isAlive = false;
        console.log(`机械狼 ${entityId} 因耐久度耗尽而停机`);

        world.broadcastEvent?.({
          type: "MechanicalWolfShutdown",
          entityId,
          reason: "durability_exhausted",
        });
      }
    }
  }

  /**
   * 检查机械狼是否可以执行技能
   */
  canUseSkill(
    entityId: EntityId,
    skillId: string,
    phase: GamePhase,
    world: any,
  ): boolean {
    const skillsComp = world.getComponent(
      entityId,
      "SkillComponent",
    ) as MechanicalWolfSkills;
    if (!skillsComp) return false;

    const skill = skillsComp.skills.find((s) => s.skillId === skillId);
    if (!skill) return false;

    // 检查冷却
    if (skill.cooldown > 0) return false;

    // 检查阶段限制
    if (!skill.canUseInPhase.includes(phase)) return false;

    // 检查机械狼状态
    const status = world.getComponent(
      entityId,
      "StatusComponent",
    ) as MechanicalWolfStatus;
    if (!status?.isAlive) return false;

    // 特殊技能额外检查
    if (skillId === "overload_self_destruct") {
      return status.durability > 0; // 需要耐久度才能自爆
    }

    return true;
  }
}
