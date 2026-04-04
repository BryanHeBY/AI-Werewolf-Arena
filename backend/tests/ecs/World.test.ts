import { GameWorld } from "../../src/ecs/World";
import { GamePhase } from "../../src/core/types";

// 创建一个简单的测试组件
class TestComponent {
  entityId: number;
  value: string;

  constructor(entityId: number) {
    this.entityId = entityId;
    this.value = "initial";
  }
}

// 创建一个简单的测试系统
class TestSystem {
  update(phase: GamePhase, entities: any[]): void {
    // 这个系统不做任何事情，只是用于测试
    console.log(
      `TestSystem.update called with phase: ${phase}, entities: ${entities.length}`,
    );
  }
}

describe("ECS World", () => {
  let world: GameWorld;

  beforeEach(() => {
    world = new GameWorld();
  });

  test("should create entity and return entity ID", () => {
    const entityId = world.createEntity();
    expect(typeof entityId).toBe("number");
    expect(entityId).toBeGreaterThan(0);
  });

  test("should add component to entity", () => {
    const entityId = world.createEntity();
    const component = new TestComponent(entityId);

    world.addComponent(entityId, component);

    const retrievedComponent = world.getComponent(entityId, "TestComponent");
    expect(retrievedComponent).toBe(component);
  });

  test("should get entities with specific component", () => {
    const entityId1 = world.createEntity();
    const entityId2 = world.createEntity();

    const component1 = new TestComponent(entityId1);
    const component2 = new TestComponent(entityId2);

    world.addComponent(entityId1, component1);
    world.addComponent(entityId2, component2);

    const entitiesWithComponent =
      world.getEntitiesWithComponent("TestComponent");
    expect(entitiesWithComponent).toHaveLength(2);
    expect(entitiesWithComponent).toContain(entityId1);
    expect(entitiesWithComponent).toContain(entityId2);
  });

  test("should register and call system update", () => {
    const system = new TestSystem();
    world.registerSystem(system);

    // 调用update方法，应该不会抛出错误
    expect(() => {
      world.update(GamePhase.NightStart);
    }).not.toThrow();
  });

  test("should remove component from entity", () => {
    const entityId = world.createEntity();
    const component = new TestComponent(entityId);

    world.addComponent(entityId, component);
    expect(world.getComponent(entityId, "TestComponent")).toBe(component);

    world.removeComponent(entityId, "TestComponent");
    expect(world.getComponent(entityId, "TestComponent")).toBeNull();
  });
});
