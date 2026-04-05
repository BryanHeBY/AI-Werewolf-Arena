import { ViewSanitizer } from "../../src/core/ViewSanitizer";
import { GameWorld } from "../../src/ecs/World";
import {
  GameState,
  Player,
  RoleType,
  Faction,
  GamePhase,
  IdentityComponent,
  StatusComponent,
} from "../../src/core/types";

describe("ViewSanitizer", () => {
  let sanitizer: ViewSanitizer;
  let world: GameWorld;
  let mockGameState: GameState;

  beforeEach(() => {
    world = new GameWorld();
    sanitizer = new ViewSanitizer(world);

    // 创建测试实体和组件
    const entityIds = [1, 2, 3, 4];

    // 实体1：狼人（存活）
    world.createEntity(1);
    world.addComponent(1, "IdentityComponent", {
      entityId: 1,
      roleType: RoleType.Wolf,
      faction: Faction.Wolf,
      name: "Player 1",
    } as IdentityComponent);
    world.addComponent(1, "StatusComponent", {
      entityId: 1,
      isAlive: true,
      isSheriff: false,
      isMuted: false,
    } as StatusComponent);

    // 实体2：村民（存活）
    world.createEntity(2);
    world.addComponent(2, "IdentityComponent", {
      entityId: 2,
      roleType: RoleType.Villager,
      faction: Faction.Villager,
      name: "Player 2",
    } as IdentityComponent);
    world.addComponent(2, "StatusComponent", {
      entityId: 2,
      isAlive: true,
      isSheriff: false,
      isMuted: false,
    } as StatusComponent);

    // 实体3：狼人（存活）
    world.createEntity(3);
    world.addComponent(3, "IdentityComponent", {
      entityId: 3,
      roleType: RoleType.Wolf,
      faction: Faction.Wolf,
      name: "Player 3",
    } as IdentityComponent);
    world.addComponent(3, "StatusComponent", {
      entityId: 3,
      isAlive: true,
      isSheriff: false,
      isMuted: false,
    } as StatusComponent);

    // 实体4：预言家（死亡）
    world.createEntity(4);
    world.addComponent(4, "IdentityComponent", {
      entityId: 4,
      roleType: RoleType.Seer,
      faction: Faction.Villager,
      name: "Player 4",
    } as IdentityComponent);
    world.addComponent(4, "StatusComponent", {
      entityId: 4,
      isAlive: false,
      isSheriff: false,
      isMuted: false,
    } as StatusComponent);

    // 创建测试用的Player数组（兼容旧接口，但去掉role字段）
    const mockPlayers: Player[] = [
      {
        id: 1,
        name: "Player 1",
        isAlive: true,
        role: new TestRole(1, RoleType.Wolf, Faction.Wolf),
        faction: Faction.Wolf,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
        isSheriff: false,
      },
      {
        id: 2,
        name: "Player 2",
        isAlive: true,
        role: new TestRole(2, RoleType.Villager, Faction.Villager),
        faction: Faction.Villager,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
        isSheriff: false,
      },
      {
        id: 3,
        name: "Player 3",
        isAlive: true,
        role: new TestRole(3, RoleType.Wolf, Faction.Wolf),
        faction: Faction.Wolf,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
        isSheriff: false,
      },
      {
        id: 4,
        name: "Player 4",
        isAlive: false, // Dead player
        role: new TestRole(4, RoleType.Seer, Faction.Villager),
        faction: Faction.Villager,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
        isSheriff: false,
      },
    ];

    mockGameState = {
      phase: GamePhase.NightStart,
      round: 1,
      players: mockPlayers,
      deadPlayerIds: [4],
      history: [],
      phaseStack: [],
      nightResult: {
        deadPlayerIds: [4],
        killedByWolf: undefined,
        savedByWitch: undefined,
        poisonedByWitch: undefined,
      },
      votedDeadId: undefined,
      winner: undefined,
      witchHasAntidote: true,
      witchHasPoison: true,
      currentSpeechIndex: 0,
    };
  });

  describe("canSeePlayerRole", () => {
    test("god view (viewerId = 0) can see all roles", () => {
      mockPlayers.forEach((player) => {
        const canSee = sanitizer.canSeePlayerRole(player, 0);
        expect(canSee).toBe(true);
      });
    });

    test("player can see their own role", () => {
      const player = mockPlayers[0]; // Player 1 (Wolf)
      const canSee = sanitizer.canSeePlayerRole(player, 1);
      expect(canSee).toBe(true);
    });

    test("alive wolf can see other alive wolf roles", () => {
      const wolf1 = mockPlayers[0]; // Player 1 (Wolf)
      const wolf2 = mockPlayers[2]; // Player 3 (Wolf)

      const canSee = sanitizer.canSeePlayerRole(
        wolf2,
        1,
        RoleType.Wolf,
        mockPlayers,
      );
      expect(canSee).toBe(true);
    });

    test("alive wolf cannot see dead wolf role", () => {
      const deadWolf: Player = {
        id: 5,
        name: "Dead Wolf",
        isAlive: false,
        role: new TestRole(5, RoleType.Wolf, Faction.Wolf),
        faction: Faction.Wolf,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
        isSheriff: false,
      };

      const canSee = sanitizer.canSeePlayerRole(deadWolf, 1, RoleType.Wolf, [
        ...mockPlayers,
        deadWolf,
      ]);
      expect(canSee).toBe(false);
    });

    test("villager cannot see wolf role", () => {
      const wolf = mockPlayers[0]; // Player 1 (Wolf)
      const canSee = sanitizer.canSeePlayerRole(
        wolf,
        2,
        RoleType.Villager,
        mockPlayers,
      );
      expect(canSee).toBe(false);
    });

    test("wolf cannot see villager role", () => {
      const villager = mockPlayers[1]; // Player 2 (Villager)
      const canSee = sanitizer.canSeePlayerRole(
        villager,
        1,
        RoleType.Wolf,
        mockPlayers,
      );
      expect(canSee).toBe(false);
    });
  });

  describe("sanitizePlayerInfoForViewer", () => {
    test("god view gets full player info", () => {
      const player = mockPlayers[0];
      const sanitized = sanitizer.sanitizePlayerInfoForViewer(
        player,
        0,
        RoleType.Wolf,
        mockPlayers,
      );

      expect(sanitized.id).toBe(player.id);
      expect(sanitized.name).toBe(player.name);
      expect(sanitized.isAlive).toBe(player.isAlive);
      expect(sanitized.roleType).toBe(player.role.roleType);
      expect(sanitized.faction).toBe(player.role.faction);
    });

    test("player gets their own full info", () => {
      const player = mockPlayers[0];
      const sanitized = sanitizer.sanitizePlayerInfoForViewer(
        player,
        1,
        RoleType.Wolf,
        mockPlayers,
      );

      expect(sanitized.roleType).toBe(player.role.roleType);
      expect(sanitized.faction).toBe(player.role.faction);
    });

    test("wolf gets other wolf info when both alive", () => {
      const wolf1 = mockPlayers[0];
      const wolf2 = mockPlayers[2];

      const sanitized = sanitizer.sanitizePlayerInfoForViewer(
        wolf2,
        1,
        RoleType.Wolf,
        mockPlayers,
      );
      expect(sanitized.roleType).toBe(wolf2.role.roleType);
      expect(sanitized.faction).toBe(wolf2.role.faction);
    });

    test("villager gets sanitized info for wolf", () => {
      const wolf = mockPlayers[0];
      const sanitized = sanitizer.sanitizePlayerInfoForViewer(
        wolf,
        2,
        RoleType.Villager,
        mockPlayers,
      );

      expect(sanitized.id).toBe(wolf.id);
      expect(sanitized.name).toBe(wolf.name);
      expect(sanitized.isAlive).toBe(wolf.isAlive);
      expect(sanitized.roleType).toBeUndefined();
      expect(sanitized.faction).toBeUndefined();
    });

    test("dead player info is sanitized for everyone", () => {
      const deadPlayer = mockPlayers[3];

      // God view
      const godView = sanitizer.sanitizePlayerInfoForViewer(
        deadPlayer,
        0,
        RoleType.Wolf,
        mockPlayers,
      );
      expect(godView.roleType).toBe(deadPlayer.role.roleType);
      expect(godView.faction).toBe(deadPlayer.role.faction);

      // Other player view
      const playerView = sanitizer.sanitizePlayerInfoForViewer(
        deadPlayer,
        1,
        RoleType.Wolf,
        mockPlayers,
      );
      expect(playerView.roleType).toBeUndefined();
      expect(playerView.faction).toBeUndefined();
    });
  });

  describe("sanitizeGameStateForViewer", () => {
    test("god view gets full game state", () => {
      const sanitized = sanitizer.sanitizeGameStateForViewer(mockGameState, 0);

      expect(sanitized.phase).toBe(mockGameState.phase);
      expect(sanitized.round).toBe(mockGameState.round);
      expect(sanitized.players).toHaveLength(4);

      // All players should have roles visible
      sanitized.players.forEach((player: any) => {
        expect(player.roleType).toBeDefined();
        expect(player.faction).toBeDefined();
      });
    });

    test("wolf view gets partial info", () => {
      const sanitized = sanitizer.sanitizeGameStateForViewer(mockGameState, 1);

      // Player 1 (viewer) should see own role
      expect(sanitized.players[0].roleType).toBeDefined();
      expect(sanitized.players[0].faction).toBeDefined();

      // Player 2 (villager) should have role hidden
      expect(sanitized.players[1].roleType).toBeUndefined();
      expect(sanitized.players[1].faction).toBeUndefined();

      // Player 3 (wolf) should have role visible to fellow wolf
      expect(sanitized.players[2].roleType).toBeDefined();
      expect(sanitized.players[2].faction).toBeDefined();

      // Player 4 (dead) should have role hidden
      expect(sanitized.players[3].roleType).toBeUndefined();
      expect(sanitized.players[3].faction).toBeUndefined();
    });

    test("villager view gets minimal info", () => {
      const sanitized = sanitizer.sanitizeGameStateForViewer(mockGameState, 2);

      // Only player 2 (viewer) should see own role
      sanitized.players.forEach((player: any, index: number) => {
        if (player.id === 2) {
          expect(player.roleType).toBeDefined();
          expect(player.faction).toBeDefined();
        } else {
          expect(player.roleType).toBeUndefined();
          expect(player.faction).toBeUndefined();
        }
      });
    });
  });

  describe("edge cases", () => {
    test("handles undefined viewer role", () => {
      const player = mockPlayers[0];
      const canSee = sanitizer.canSeePlayerRole(
        player,
        1,
        undefined,
        mockPlayers,
      );

      // Without role, can only see own info
      expect(canSee).toBe(player.id === 1);
    });

    test("handles empty player list", () => {
      const player = mockPlayers[0];
      const canSee = sanitizer.canSeePlayerRole(player, 1, RoleType.Wolf, []);

      // Without player list, wolf cannot identify other wolves
      expect(canSee).toBe(player.id === 1);
    });

    test("handles null/undefined values gracefully", () => {
      // Should not throw with null inputs
      expect(() => {
        sanitizer.canSeePlayerRole(
          mockPlayers[0],
          1,
          RoleType.Wolf,
          undefined as any,
        );
      }).not.toThrow();
    });
  });
});
