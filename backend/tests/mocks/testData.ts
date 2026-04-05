import {
  GameState,
  GamePhase,
  Player,
  RoleType,
  Faction,
  Role,
  ModelConfig,
} from "../../src/core/types";
import { VillagerRole } from "../../src/roles/VillagerRole";
import { WolfRole } from "../../src/roles/WolfRole";
import { SeerRole } from "../../src/roles/SeerRole";
import { WitchRole } from "../../src/roles/WitchRole";

function createRole(
  playerId: number,
  roleType: RoleType,
  modelConfig: ModelConfig,
): Role {
  switch (roleType) {
    case RoleType.Wolf:
      return new WolfRole(playerId, modelConfig);
    case RoleType.Villager:
      return new VillagerRole(playerId, modelConfig);
    case RoleType.Seer:
      return new SeerRole(playerId, modelConfig);
    case RoleType.Witch:
      return new WitchRole(playerId, modelConfig);
    default:
      throw new Error(`Unknown role type: ${roleType}`);
  }
}

export function createCompleteGameState(
  overrides: Partial<GameState> = {},
): GameState {
  const modelConfig = {
    baseURL: "http://test.local",
    apiKey: "test-key",
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 1024,
  };

  const baseState: GameState = {
    phase: GamePhase.NightStart,
    round: 1,
    players: [
      {
        id: 1,
        name: "Player 1",
        role: createRole(1, RoleType.Wolf, modelConfig),
        isAlive: true,
        faction: Faction.Wolf,
        modelConfig,
      },
      {
        id: 2,
        name: "Player 2",
        role: createRole(2, RoleType.Wolf, modelConfig),
        isAlive: true,
        faction: Faction.Wolf,
        modelConfig,
      },
      {
        id: 3,
        name: "Player 3",
        role: createRole(3, RoleType.Seer, modelConfig),
        isAlive: true,
        faction: Faction.Villager,
        modelConfig,
      },
      {
        id: 4,
        name: "Player 4",
        role: createRole(4, RoleType.Witch, modelConfig),
        isAlive: true,
        faction: Faction.Villager,
        modelConfig,
      },
      {
        id: 5,
        name: "Player 5",
        role: createRole(5, RoleType.Villager, modelConfig),
        isAlive: true,
        faction: Faction.Villager,
        modelConfig,
      },
      {
        id: 6,
        name: "Player 6",
        role: createRole(6, RoleType.Villager, modelConfig),
        isAlive: true,
        faction: Faction.Villager,
        modelConfig,
      },
    ],
    deadPlayerIds: [],
    history: [],
    witchHasAntidote: true,
    witchHasPoison: true,
    currentSpeechIndex: 0,
    phaseStack: [{ phase: GamePhase.NightStart }],
  };

  return { ...baseState, ...overrides };
}

export function createSimplePlayer(
  id: number,
  roleType: RoleType = RoleType.Villager,
): Player {
  const modelConfig = {
    baseURL: "http://test.local",
    apiKey: "test-key",
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 1024,
  };

  const role = createRole(id, roleType, modelConfig);

  return {
    id,
    name: `Player ${id}`,
    role,
    isAlive: true,
    faction: role.faction,
    modelConfig,
  };
}
