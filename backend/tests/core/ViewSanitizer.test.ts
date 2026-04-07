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

// 辅助函数：从ECS World获取角色信息
const getRoleInfoFromWorld = (world: GameWorld, playerId: number) => {
  const identity = world.getComponent<IdentityComponent>(
    playerId,
    "IdentityComponent",
  );
  return {
    roleType: identity?.roleType,
    faction: identity?.faction,
  };
};

// 辅助函数：从ECS World获取viewer的角色信息
const getViewerRoleFromWorld = (world: GameWorld, viewerId: number) => {
  const identity = world.getComponent<IdentityComponent>(
    viewerId,
    "IdentityComponent",
  );
  return identity?.roleType;
};

describe("ViewSanitizer", () => {
  let sanitizer: ViewSanitizer;
  let world: GameWorld;
  let mockGameState: GameState;
  let mockPlayers: Player[];

  beforeEach(() => {
    world = new GameWorld();
    sanitizer = new ViewSanitizer(world);

    // 创建测试实体和组件
    const entityIds = [1, 2, 3, 4];

    // 实体1：狼人（存活）
    const entityId1 = world.createEntity();
    world.addComponent(
      entityId1,
      {
        entityId: entityId1,
        roleType: RoleType.Wolf,
        faction: Faction.Wolf,
        name: "Player 1",
      } as IdentityComponent,
      "IdentityComponent",
    );
    world.addComponent(
      entityId1,
      {
        entityId: entityId1,
        isAlive: true,
        isSheriff: false,
        isMuted: false,
      } as StatusComponent,
      "StatusComponent",
    );

    // 实体2：村民（存活）
    const entityId2 = world.createEntity();
    world.addComponent(
      entityId2,
      {
        entityId: entityId2,
        roleType: RoleType.Villager,
        faction: Faction.Villager,
        name: "Player 2",
      } as IdentityComponent,
      "IdentityComponent",
    );
    world.addComponent(
      entityId2,
      {
        entityId: entityId2,
        isAlive: true,
        isSheriff: false,
        isMuted: false,
      } as StatusComponent,
      "StatusComponent",
    );

    // 实体3：狼人（存活）
    const entityId3 = world.createEntity();
    world.addComponent(
      entityId3,
      {
        entityId: entityId3,
        roleType: RoleType.Wolf,
        faction: Faction.Wolf,
        name: "Player 3",
      } as IdentityComponent,
      "IdentityComponent",
    );
    world.addComponent(
      entityId3,
      {
        entityId: entityId3,
        isAlive: true,
        isSheriff: false,
        isMuted: false,
      } as StatusComponent,
      "StatusComponent",
    );

    // 实体4：预言家（死亡）
    const entityId4 = world.createEntity();
    world.addComponent(
      entityId4,
      {
        entityId: entityId4,
        roleType: RoleType.Seer,
        faction: Faction.Villager,
        name: "Player 4",
      } as IdentityComponent,
      "IdentityComponent",
    );
    world.addComponent(
      entityId4,
      {
        entityId: entityId4,
        isAlive: false,
        isSheriff: false,
        isMuted: false,
      } as StatusComponent,
      "StatusComponent",
    );

    // 创建测试用的Player数组（去掉role字段，使用ECS World获取角色信息）
    mockPlayers = [
      {
        id: entityId1,
        name: "Player 1",
        isAlive: true,
        faction: Faction.Wolf,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
      },
      {
        id: entityId2,
        name: "Player 2",
        isAlive: true,
        faction: Faction.Villager,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
      },
      {
        id: entityId3,
        name: "Player 3",
        isAlive: true,
        faction: Faction.Wolf,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
      },
      {
        id: entityId4,
        name: "Player 4",
        isAlive: false, // Dead player
        faction: Faction.Villager,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
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
      const canSee = sanitizer.canSeePlayerRole(player, player.id);
      expect(canSee).toBe(true);
    });

    test("alive wolf can see other alive wolf roles", () => {
      const wolf1 = mockPlayers[0]; // Player 1 (Wolf)
      const wolf2 = mockPlayers[2]; // Player 3 (Wolf)
      const viewerRole = getViewerRoleFromWorld(world, wolf1.id);

      // 确保viewerRole是RoleType.Wolf
      expect(viewerRole).toBe(RoleType.Wolf);

      // 确保wolf1和wolf2都存活
      expect(wolf1.isAlive).toBe(true);
      expect(wolf2.isAlive).toBe(true);

      // 确保World中有正确的组件
      const wolf2Identity = world.getComponent<IdentityComponent>(
        wolf2.id,
        "IdentityComponent",
      );
      expect(wolf2Identity).not.toBeNull();
      expect(wolf2Identity?.roleType).toBe(RoleType.Wolf);

      const canSee = sanitizer.canSeePlayerRole(
        wolf2,
        wolf1.id,
        viewerRole,
        mockPlayers,
      );
      expect(canSee).toBe(true);
    });

    test("alive wolf cannot see dead wolf role", () => {
      const wolf1 = mockPlayers[0]; // Player 1 (Wolf)

      // 创建死狼实体
      const deadWolfEntityId = world.createEntity();
      world.addComponent(
        deadWolfEntityId,
        {
          entityId: deadWolfEntityId,
          roleType: RoleType.Wolf,
          faction: Faction.Wolf,
          name: "Dead Wolf",
        } as IdentityComponent,
        "IdentityComponent",
      );
      world.addComponent(
        deadWolfEntityId,
        {
          entityId: deadWolfEntityId,
          isAlive: false,
          isSheriff: false,
          isMuted: false,
        } as StatusComponent,
        "StatusComponent",
      );

      const deadWolf: Player = {
        id: deadWolfEntityId,
        name: "Dead Wolf",
        isAlive: false,
        faction: Faction.Wolf,
        modelConfig: {
          baseURL: "",
          apiKey: "",
          model: "",
          temperature: 0.7,
          maxTokens: 1024,
        },
      };

      const viewerRole = getViewerRoleFromWorld(world, wolf1.id);
      const canSee = sanitizer.canSeePlayerRole(
        deadWolf,
        wolf1.id,
        viewerRole,
        [...mockPlayers, deadWolf],
      );
      expect(canSee).toBe(false);
    });

    test("villager cannot see wolf role", () => {
      const wolf = mockPlayers[0]; // Player 1 (Wolf)
      const villager = mockPlayers[1]; // Player 2 (Villager)
      const viewerRole = getViewerRoleFromWorld(world, villager.id);
      const canSee = sanitizer.canSeePlayerRole(
        wolf,
        villager.id,
        viewerRole,
        mockPlayers,
      );
      expect(canSee).toBe(false);
    });

    test("wolf cannot see villager role", () => {
      const wolf = mockPlayers[0]; // Player 1 (Wolf)
      const villager = mockPlayers[1]; // Player 2 (Villager)
      const viewerRole = getViewerRoleFromWorld(world, wolf.id);
      const canSee = sanitizer.canSeePlayerRole(
        villager,
        wolf.id,
        viewerRole,
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
        RoleType.Wolf, // God view可以传递任意viewerRole
        mockPlayers,
      );

      const roleInfo = getRoleInfoFromWorld(world, player.id);
      expect(sanitized.id).toBe(player.id);
      expect(sanitized.name).toBe(player.name);
      expect(sanitized.isAlive).toBe(player.isAlive);
      expect(sanitized.roleType).toBe(roleInfo.roleType);
      expect(sanitized.faction).toBe(roleInfo.faction);
    });

    test("player gets their own full info", () => {
      const player = mockPlayers[0];
      const viewerRole = getViewerRoleFromWorld(world, player.id);
      const sanitized = sanitizer.sanitizePlayerInfoForViewer(
        player,
        player.id,
        viewerRole,
        mockPlayers,
      );

      const roleInfo = getRoleInfoFromWorld(world, player.id);
      expect(sanitized.roleType).toBe(roleInfo.roleType);
      expect(sanitized.faction).toBe(roleInfo.faction);
    });

    test("wolf gets other wolf info when both alive", () => {
      const wolf1 = mockPlayers[0];
      const wolf2 = mockPlayers[2];
      const viewerRole = getViewerRoleFromWorld(world, wolf1.id);

      const sanitized = sanitizer.sanitizePlayerInfoForViewer(
        wolf2,
        wolf1.id,
        viewerRole,
        mockPlayers,
      );
      const roleInfo = getRoleInfoFromWorld(world, wolf2.id);
      expect(sanitized.roleType).toBe(roleInfo.roleType);
      expect(sanitized.faction).toBe(roleInfo.faction);
    });

    test("villager gets sanitized info for wolf", () => {
      const wolf = mockPlayers[0];
      const villager = mockPlayers[1];
      const viewerRole = getViewerRoleFromWorld(world, villager.id);
      const sanitized = sanitizer.sanitizePlayerInfoForViewer(
        wolf,
        villager.id,
        viewerRole,
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
      const wolfViewer = mockPlayers[0];
      const viewerRole = getViewerRoleFromWorld(world, wolfViewer.id);

      // God view
      const godView = sanitizer.sanitizePlayerInfoForViewer(
        deadPlayer,
        0,
        RoleType.Wolf, // God view可以传递任意viewerRole
        mockPlayers,
      );
      const roleInfo = getRoleInfoFromWorld(world, deadPlayer.id);
      expect(godView.roleType).toBe(roleInfo.roleType);
      expect(godView.faction).toBe(roleInfo.faction);

      // Other player view
      const playerView = sanitizer.sanitizePlayerInfoForViewer(
        deadPlayer,
        wolfViewer.id,
        viewerRole,
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

      // All players should have roles visible in god view
      sanitized.players.forEach((player: any) => {
        expect(player.roleType).toBeDefined();
        expect(player.faction).toBeDefined();
      });
    });

    test("wolf view gets partial info", () => {
      // 使用第一个玩家（狼人）的ID作为viewerId
      const wolfViewerId = mockPlayers[0].id;
      const sanitized = sanitizer.sanitizeGameStateForViewer(
        mockGameState,
        wolfViewerId,
      );

      // Player 1 (wolf viewer) should see own role
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
      // 使用第二个玩家（村民）的ID作为viewerId
      const villagerViewerId = mockPlayers[1].id;
      const sanitized = sanitizer.sanitizeGameStateForViewer(
        mockGameState,
        villagerViewerId,
      );

      // Only the viewer (villager) should see own role
      sanitized.players.forEach((player: any, index: number) => {
        if (player.id === villagerViewerId) {
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
        player.id,
        undefined,
        mockPlayers,
      );

      // Without role, can only see own info
      expect(canSee).toBe(player.id === player.id);
    });

    test("handles empty player list", () => {
      const player = mockPlayers[0];
      const viewerRole = getViewerRoleFromWorld(world, player.id);
      const canSee = sanitizer.canSeePlayerRole(
        player,
        player.id,
        viewerRole,
        [],
      );

      // Without player list, wolf cannot identify other wolves
      expect(canSee).toBe(player.id === player.id);
    });

    test("handles null/undefined values gracefully", () => {
      // Should not throw with null inputs
      expect(() => {
        sanitizer.canSeePlayerRole(
          mockPlayers[0],
          mockPlayers[0].id,
          RoleType.Wolf,
          undefined as any,
        );
      }).not.toThrow();
    });
  });
});
