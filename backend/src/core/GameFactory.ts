import { Player, GameConfig, ModelConfig, Role, RoleType } from './types';
import { WolfRole } from '../roles/WolfRole';
import { VillagerRole } from '../roles/VillagerRole';
import { SeerRole } from '../roles/SeerRole';
import { WitchRole } from '../roles/WitchRole';

export class GameFactory {
  private modelConfig: ModelConfig;
  private gameConfig: GameConfig;

  constructor(gameConfig: GameConfig, modelConfig: ModelConfig) {
    this.gameConfig = gameConfig;
    this.modelConfig = modelConfig;
  }

  createPlayers(): Player[] {
    const roles: RoleType[] = [];

    // Add wolves
    for (let i = 0; i < this.gameConfig.wolfCount; i++) {
      roles.push(RoleType.Wolf);
    }

    // Add villagers
    for (let i = 0; i < this.gameConfig.villagerCount; i++) {
      roles.push(RoleType.Villager);
    }

    // Add seer
    for (let i = 0; i < this.gameConfig.seerCount; i++) {
      roles.push(RoleType.Seer);
    }

    // Add witch
    for (let i = 0; i < this.gameConfig.witchCount; i++) {
      roles.push(RoleType.Witch);
    }

    // Shuffle roles (Fisher-Yates)
    this.shuffleArray(roles);

    // Create players - names don't include role suffix to prevent data leaks
    const players: Player[] = roles.map((roleType, index) => {
      const playerId = index + 1; // Player IDs start from 1
      const role = this.createRole(playerId, roleType, this.modelConfig);
      return {
        id: playerId,
        name: `Player ${playerId}`,
        role,
        isAlive: true,
        faction: role.faction,
        modelConfig: this.modelConfig,
      };
    });

    return players;
  }

  private createRole(playerId: number, roleType: RoleType, config: ModelConfig): Role {
    switch (roleType) {
      case RoleType.Wolf:
        return new WolfRole(playerId, config);
      case RoleType.Villager:
        return new VillagerRole(playerId, config);
      case RoleType.Seer:
        return new SeerRole(playerId, config);
      case RoleType.Witch:
        return new WitchRole(playerId, config);
      default:
        throw new Error(`Unknown role type: ${roleType}`);
    }
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
