import { GameFactoryV2 } from "../../src/core/GameFactoryV2";
import { GameWorld } from "../../src/ecs/World";
import {
  GameConfig,
  ModelConfig,
  RoleType,
  Faction,
  IdentityComponent,
  StatusComponent,
  SkillComponent,
} from "../../src/core/types";

describe("GameFactoryV2", () => {
  let gameConfig: GameConfig;
  let modelConfig: ModelConfig;
  let world: GameWorld;
  let factory: GameFactoryV2;

  beforeEach(() => {
    gameConfig = {
      totalPlayers: 6,
      wolfCount: 2,
      villagerCount: 2,
      seerCount: 1,
      witchCount: 1,
      modelDefaults: {
        baseURL: "http://test.local",
        apiKey: "test-key",
        model: "test-model",
        temperature: 0.7,
        maxTokens: 1024,
      },
    };

    modelConfig = {
      baseURL: "http://test.local",
      apiKey: "test-key",
      model: "test-model",
      temperature: 0.7,
      maxTokens: 1024,
    };

    world = new GameWorld();
    factory = new GameFactoryV2(gameConfig, modelConfig, world);
  });

  describe("createPlayers", () => {
    it("should create correct number of players in World", () => {
      factory.createPlayers();
      const entities = world.getEntitiesWithComponent("IdentityComponent");
      expect(entities).toHaveLength(6);
    });

    it("should assign correct role distribution in World", () => {
      factory.createPlayers();
      const entities = world.getEntitiesWithComponent("IdentityComponent");

      let wolfCount = 0;
      let villagerCount = 0;
      let seerCount = 0;
      let witchCount = 0;

      entities.forEach((entityId) => {
        const identity = world.getComponent(
          entityId,
          "IdentityComponent",
        ) as IdentityComponent;
        if (identity.roleType === RoleType.Wolf) wolfCount++;
        else if (identity.roleType === RoleType.Villager) villagerCount++;
        else if (identity.roleType === RoleType.Seer) seerCount++;
        else if (identity.roleType === RoleType.Witch) witchCount++;
      });

      expect(wolfCount).toBe(2);
      expect(villagerCount).toBe(2);
      expect(seerCount).toBe(1);
      expect(witchCount).toBe(1);
    });

    it("should assign correct factions in World", () => {
      factory.createPlayers();
      const entities = world.getEntitiesWithComponent("IdentityComponent");

      entities.forEach((entityId) => {
        const identity = world.getComponent(
          entityId,
          "IdentityComponent",
        ) as IdentityComponent;
        if (identity.roleType === RoleType.Wolf) {
          expect(identity.faction).toBe(Faction.Wolf);
        } else {
          expect(identity.faction).toBe(Faction.Villager);
        }
      });
    });

    it("should create alive players with status components", () => {
      factory.createPlayers();
      const entities = world.getEntitiesWithComponent("IdentityComponent");

      entities.forEach((entityId) => {
        const status = world.getComponent(
          entityId,
          "StatusComponent",
        ) as StatusComponent;
        expect(status).toBeDefined();
        expect(status.isAlive).toBe(true);
      });
    });
  });

  describe("ECS component creation", () => {
    it("should create all three component types for each player", () => {
      factory.createPlayers();
      const entities = world.getEntitiesWithComponent("IdentityComponent");

      entities.forEach((entityId) => {
        const identity = world.getComponent(entityId, "IdentityComponent");
        const status = world.getComponent(entityId, "StatusComponent");
        const skills = world.getComponent(entityId, "SkillComponent");

        expect(identity).toBeDefined();
        expect(status).toBeDefined();
        expect(skills).toBeDefined();
      });
    });

    it("should have correct skill assignments", () => {
      factory.createPlayers();
      const entities = world.getEntitiesWithComponent("IdentityComponent");

      entities.forEach((entityId) => {
        const identity = world.getComponent(
          entityId,
          "IdentityComponent",
        ) as IdentityComponent;
        const skills = world.getComponent(
          entityId,
          "SkillComponent",
        ) as SkillComponent;

        expect(skills).toBeDefined();
        expect(skills.skills).toBeDefined();

        if (identity.roleType === RoleType.Wolf) {
          const hasKillSkill = skills.skills.some(
            (skill) => skill.name === "杀人" || skill.name.includes("Kill"),
          );
          expect(hasKillSkill).toBe(true);
        }
      });
    });
  });
});
