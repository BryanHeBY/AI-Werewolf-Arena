import {
  GameConfig,
  ModelConfig,
  RoleType,
  IdentityComponent,
  StatusComponent,
  SkillComponent,
  Skill,
  EntityId,
  Faction,
  GamePhase,
} from "./types";
import { GameWorld } from "../ecs/World";

export class GameFactoryV2 {
  constructor(
    private gameConfig: GameConfig,
    private modelConfig: ModelConfig,
    private world: GameWorld,
  ) {}

  createPlayers(): void {
    const roles: RoleType[] = [];

    for (let i = 0; i < this.gameConfig.wolfCount; i++) {
      roles.push(RoleType.Wolf);
    }
    for (let i = 0; i < this.gameConfig.villagerCount; i++) {
      roles.push(RoleType.Villager);
    }
    for (let i = 0; i < this.gameConfig.seerCount; i++) {
      roles.push(RoleType.Seer);
    }
    for (let i = 0; i < this.gameConfig.witchCount; i++) {
      roles.push(RoleType.Witch);
    }

    this.shuffleArray(roles);

    // 真正的ECS初始化：向World注册所有Entity和Component
    roles.forEach((roleType, index) => {
      const playerId = index + 1;
      const entityId = this.world.createEntity();

      // 注入核心数据：IdentityComponent
      const identityComponent: IdentityComponent = {
        entityId,
        roleType,
        faction: roleType === RoleType.Wolf ? Faction.Wolf : Faction.Villager,
        name: `Player ${playerId}`,
      };
      this.world.addComponent(entityId, identityComponent, "IdentityComponent");

      // 注入状态数据：StatusComponent
      const statusComponent: StatusComponent = {
        entityId,
        isAlive: true,
        isSheriff: false,
        isMuted: false,
      };
      this.world.addComponent(entityId, statusComponent, "StatusComponent");

      // 注入技能数据：SkillComponent
      const skills = this.getRoleSkills(roleType, entityId);
      const skillComponent: SkillComponent = {
        entityId,
        skills,
      };
      this.world.addComponent(entityId, skillComponent, "SkillComponent");
    });

    // 注意：不再返回Player数组！所有数据都在World中
  }

  private getRoleSkills(roleType: RoleType, entityId: EntityId): Skill[] {
    const skills: Skill[] = [];

    switch (roleType) {
      case RoleType.Wolf:
        skills.push(this.createWolfKillSkill(entityId));
        break;
      case RoleType.Seer:
        skills.push(this.createSeerCheckSkill(entityId));
        break;
      case RoleType.Witch:
        skills.push(this.createWitchAntidoteSkill(entityId));
        skills.push(this.createWitchPoisonSkill(entityId));
        break;
      case RoleType.Villager:
        break;
    }

    return skills;
  }

  private createWolfKillSkill(entityId: EntityId): Skill {
    return {
      skillId: "kill",
      name: "杀人",
      cooldown: 0,
      canUseInPhase: [GamePhase.WolfAction],
      execute: (executorId: EntityId, targetId?: EntityId) => {
        console.log(`狼人 ${executorId} 对玩家 ${targetId} 使用了杀人技能`);
      },
    };
  }

  private createSeerCheckSkill(entityId: EntityId): Skill {
    return {
      skillId: "check",
      name: "查验",
      cooldown: 0,
      canUseInPhase: [GamePhase.SeerAction],
      execute: (executorId: EntityId, targetId?: EntityId) => {
        console.log(`预言家 ${executorId} 查验了玩家 ${targetId} 的身份`);
      },
    };
  }

  private createWitchAntidoteSkill(entityId: EntityId): Skill {
    return {
      skillId: "antidote",
      name: "解药",
      cooldown: Infinity,
      canUseInPhase: [GamePhase.WitchAction],
      execute: (executorId: EntityId, targetId?: EntityId) => {
        console.log(`女巫 ${executorId} 对玩家 ${targetId} 使用了解药`);
      },
    };
  }

  private createWitchPoisonSkill(entityId: EntityId): Skill {
    return {
      skillId: "poison",
      name: "毒药",
      cooldown: Infinity,
      canUseInPhase: [GamePhase.WitchAction],
      execute: (executorId: EntityId, targetId?: EntityId) => {
        console.log(`女巫 ${executorId} 对玩家 ${targetId} 使用了毒药`);
      },
    };
  }

  private canRoleActInPhase(roleType: RoleType, phase: GamePhase): boolean {
    const rolePhaseMap: Record<RoleType, GamePhase[]> = {
      [RoleType.Wolf]: [GamePhase.WolfAction],
      [RoleType.Seer]: [GamePhase.SeerAction],
      [RoleType.Witch]: [GamePhase.WitchAction],
      [RoleType.Villager]: [GamePhase.Vote, GamePhase.SequentialSpeech],
    };

    return rolePhaseMap[roleType]?.includes(phase) || false;
  }

  private getRoleSystemPrompt(roleType: RoleType): string {
    const prompts: Record<RoleType, string> = {
      [RoleType.Wolf]:
        "你是狼人，每晚可以杀死一名玩家。目标是杀死所有村民阵营的玩家。",
      [RoleType.Seer]:
        "你是预言家，每晚可以查验一名玩家的阵营。帮助村民找出狼人。",
      [RoleType.Witch]:
        "你是女巫，有一瓶解药和一瓶毒药。解药可以救活被狼人杀死的玩家，毒药可以杀死一名玩家。",
      [RoleType.Villager]: "你是村民，没有特殊能力。通过发言和投票找出狼人。",
    };

    return prompts[roleType] || "你是游戏玩家，请按照游戏规则行动。";
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
