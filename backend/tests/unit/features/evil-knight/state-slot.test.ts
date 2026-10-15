/**
 * 单元测试验证恶夜骑士初始化和反射付款的真实读取／失败前缀。
 * 输入是测试自有角色、生命与原绑定，预期使用手写顺序和资源字段；不生成镜像 oracle。
 * 数据槽不授行动许可；使用真实反射命令复核来源，构造失败不退款，不运行模型或完整对局。
 */
import { expect, test } from "bun:test";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { Camp, Role } from "../../../../src/domain/identity";
import { captureNightLife } from "../../../../src/domain/night-effects";
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { EVIL_KNIGHT_ROLE_PROFILE } from "../../../../src/features/evil-knight/profile";
import { EVIL_KNIGHT_STATE_SLOT } from "../../../../src/features/evil-knight/state-slot";
import {
  captureEvilKnight,
  commitEvilKnightReflection,
} from "../../../../src/features/evil-knight/reflection";

test("evil knight initialization evaluates the original left side before parsing policy", () => {
  const trace: string[] = [];
  let assigned: unknown;
  const container: Record<string, unknown> = {};
  Object.defineProperty(container, "evilKnight", {
    set(value) {
      trace.push("assign");
      assigned = value;
    },
  });
  const role = {
    role: Role.EvilKnight,
    get privateState() {
      trace.push("container");
      return container;
    },
  };
  const initialCamp = { camp: Camp.Wolf };
  const context = {
    initialCamp,
    currentCamp: () => initialCamp,
    get boardConfig() {
      trace.push("board");
      return undefined;
    },
  };
  EVIL_KNIGHT_ROLE_PROFILE.runtime.init!(role, context);
  expect(trace).toEqual(["container", "board", "assign"]);
  expect(assigned).toEqual({
    policy: "awa_evil_knight_v1",
    shotPolicy: "night_shot_immune",
    reflectionRemaining: 1,
  });

  const failure = new Error("test_evil_knight_container_failure");
  trace.length = 0;
  const bad = {
    role: Role.EvilKnight,
    get privateState(): Record<string, unknown> {
      trace.push("container");
      throw failure;
    },
  };
  expect(() => EVIL_KNIGHT_ROLE_PROFILE.runtime.init!(bad, context)).toThrow(failure);
  expect(trace).toEqual(["container"]);
});

test("evil knight caster container failure precedes payment while attack construction failure retains payment", () => {
  const world = new World();
  const knight = world.createEntity(),
    casterId = world.createEntity();
  const knightRole = createRoleComponent(Role.EvilKnight);
  const casterRole = createRoleComponent(Role.Seer);
  const state = EVIL_KNIGHT_STATE_SLOT.create();
  Object.assign(knightRole.privateState, { evilKnight: state });
  for (const [id, role] of [
    [knight, knightRole],
    [casterId, casterRole],
  ] as const) {
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: id === knight ? Camp.Wolf : Camp.Good });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  const binding = captureEvilKnight(world, captureNightLife(world, knight)!)!;
  const caster = captureNightLife(world, casterId)!;
  const beforePayment = new Error("test_evil_knight_caster_container_failure");
  const descriptor = Object.getOwnPropertyDescriptor(casterRole, "privateState")!;
  Object.defineProperty(casterRole, "privateState", {
    configurable: true,
    get() {
      throw beforePayment;
    },
  });
  try {
    expect(() =>
      commitEvilKnightReflection(world, binding, caster, "seer_check", () => true),
    ).toThrow(beforePayment);
    expect(state.reflectionRemaining).toBe(1);
  } finally {
    Object.defineProperty(casterRole, "privateState", descriptor);
  }

  // 原 binding 的 target 只在付款之后组装攻击时读取；失败不退回已经消费的单次余量。
  const afterPayment = new Error("test_evil_knight_attack_target_failure");
  Object.defineProperty(binding, "target", {
    get() {
      throw afterPayment;
    },
  });
  expect(() =>
    commitEvilKnightReflection(world, binding, caster, "seer_check", () => true),
  ).toThrow(afterPayment);
  expect(state.reflectionRemaining).toBe(0);
  expect(
    EVIL_KNIGHT_STATE_SLOT.get(knightRole, () => world.getComponent(knight, COMPONENT.Camp)),
  ).toBe(state);
  expect(world.getComponent(casterId, COMPONENT.Alive)!.alive).toBe(true);
});
