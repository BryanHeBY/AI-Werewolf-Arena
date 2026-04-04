import { GameWorld } from "../../src/ecs/World";

describe("ECS Entity Management", () => {
  let world: GameWorld;

  beforeEach(() => {
    world = new GameWorld();
  });

  test("should create entities with unique IDs", () => {
    const id1 = world.createEntity();
    const id2 = world.createEntity();
    const id3 = world.createEntity();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);

    expect(id2).toBe(id1 + 1);
    expect(id3).toBe(id2 + 1);
  });

  test("should handle adding and retrieving components correctly", () => {
    const entityId = world.createEntity();

    class HealthComponent {
      entityId: number;
      current: number;
      max: number;

      constructor(entityId: number, max: number = 100) {
        this.entityId = entityId;
        this.current = max;
        this.max = max;
      }
    }

    class PositionComponent {
      entityId: number;
      x: number;
      y: number;

      constructor(entityId: number, x: number = 0, y: number = 0) {
        this.entityId = entityId;
        this.x = x;
        this.y = y;
      }
    }

    const health = new HealthComponent(entityId, 150);
    const position = new PositionComponent(entityId, 10, 20);

    world.addComponent(entityId, health);
    world.addComponent(entityId, position);

    const retrievedHealth = world.getComponent(entityId, "HealthComponent");
    const retrievedPosition = world.getComponent(entityId, "PositionComponent");

    expect(retrievedHealth).toBe(health);
    expect(retrievedPosition).toBe(position);

    expect((retrievedHealth as HealthComponent).max).toBe(150);
    expect((retrievedPosition as PositionComponent).x).toBe(10);
  });

  test("should throw error when adding component to non-existent entity", () => {
    class TestComponent {
      entityId: number;

      constructor(entityId: number) {
        this.entityId = entityId;
      }
    }

    const nonExistentEntityId = 999;
    const component = new TestComponent(nonExistentEntityId);

    expect(() => {
      world.addComponent(nonExistentEntityId, component);
    }).toThrow(`Entity ${nonExistentEntityId} does not exist`);
  });

  test("should return null when getting non-existent component", () => {
    const entityId = world.createEntity();

    const component = world.getComponent(entityId, "NonExistentComponent");
    expect(component).toBeNull();
  });

  test("should correctly manage entities with specific components", () => {
    class RenderComponent {
      entityId: number;
      visible: boolean;

      constructor(entityId: number, visible: boolean = true) {
        this.entityId = entityId;
        this.visible = visible;
      }
    }

    const entityWithRender1 = world.createEntity();
    const entityWithRender2 = world.createEntity();
    const entityWithoutRender = world.createEntity();

    const render1 = new RenderComponent(entityWithRender1);
    const render2 = new RenderComponent(entityWithRender2, false);

    world.addComponent(entityWithRender1, render1);
    world.addComponent(entityWithRender2, render2);

    const renderEntities = world.getEntitiesWithComponent("RenderComponent");

    expect(renderEntities).toHaveLength(2);
    expect(renderEntities).toContain(entityWithRender1);
    expect(renderEntities).toContain(entityWithRender2);
    expect(renderEntities).not.toContain(entityWithoutRender);
  });
});
