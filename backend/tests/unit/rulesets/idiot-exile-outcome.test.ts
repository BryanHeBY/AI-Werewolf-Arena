/**
 * 单元测试：验证白痴放逐组合的原生审计先行与普通／原生提交后的失败前缀。
 * 输入为真实组件或已安装猎魔板子的 World；输出断言独立手写的读取次数、票权、生命和审计结果。
 * 不模拟完整对局，也不绕过权威付款；注入错误仅观察已写前缀，不改变生产规则或授权。
 */
import { expect, test } from "bun:test";
import { COMPONENT, type ComponentName } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { createRoleComponent } from "../../../src/domain/components/role";
import { createVotingRightComponent } from "../../../src/domain/components/voting-right";
import { Camp, Role, type GameEvent } from "../../../src/domain/model";
import { World } from "../../../src/domain/world";
import { setIdiotState, getIdiotState } from "../../../src/features/idiot/state";
import {
  beginDemonHunterNight,
  freezeDemonHunt,
  closeDemonHunterNight,
  demonHunterCheckpointPlayers,
} from "../../../src/features/demon-hunter/authority";
import { idiotVotedOutHook } from "../../../src/rulesets/idiot-exile-outcome";
import { redMoonCandidateWorld } from "../../support/features/red-moon/builders/candidate-world";

function nativeDay() {
  const fixture = redMoonCandidateWorld();
  beginDemonHunterNight(fixture.world, 1, () => true);
  freezeDemonHunt(fixture.world);
  closeDemonHunterNight(fixture.world);
  return fixture.world;
}

test("native audit rejection precedes an unaudited reveal getter and ordinary writes", () => {
  const world = nativeDay();
  const role = world.getComponent(12, COMPONENT.Role)!;
  const state = getIdiotState(role)!;
  let reads = 0;
  Object.defineProperty(state, "revealed", {
    get() {
      reads++;
      return true;
    },
    configurable: true,
  });
  const events: GameEvent[] = [];
  expect(() => idiotVotedOutHook(world, 12, events)).toThrow("demon_hunter_idiot_state_revoked");
  expect(reads).toBe(0);
  expect(world.getComponent(12, COMPONENT.VotingRight)!.canVote).toBe(true);
  expect(world.getComponent(12, COMPONENT.VotingRight)!.weight).toBe(1);
  expect(world.getComponent(12, COMPONENT.Alive)!.alive).toBe(true);
  expect(events).toEqual([]);
});

test("ordinary badge lookup failure preserves reveal and voting writes without killing", () => {
  const world = new World();
  const id = world.createEntity();
  const role = createRoleComponent(Role.Idiot);
  setIdiotState(role, { revealed: false });
  const voting = createVotingRightComponent();
  const alive = createAliveComponent();
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(id, COMPONENT.VotingRight, voting);
  world.addComponent(id, COMPONENT.Alive, alive);
  const originalGet = world.getComponent;
  const failure = new Error("badge_lookup_failed");
  const reads: string[] = [];
  Object.defineProperty(world, "getComponent", {
    value: function (this: World, entity: number, component: ComponentName) {
      reads.push(component);
      if (component === COMPONENT.Badge) throw failure;
      return originalGet.call(this, entity, component);
    },
  });
  const events: GameEvent[] = [];
  expect(() => idiotVotedOutHook(world, id, events)).toThrow(failure);
  expect(reads).toEqual([COMPONENT.Role, COMPONENT.Alive, COMPONENT.VotingRight, COMPONENT.Badge]);
  expect(getIdiotState(role)).toEqual({ revealed: true });
  expect(voting).toEqual({ canVote: false, weight: 0 });
  expect(alive.alive).toBe(true);
  expect(events).toEqual([]);
  // 再次翻牌在警徽读取前返回，不把上次失败当作恢复票权的理由。
  reads.length = 0;
  expect(idiotVotedOutHook(world, id, events)?.reason).toBe("idiot_already_revealed");
  expect(reads).toEqual([COMPONENT.Role, COMPONENT.Alive]);
});

test("native event publication failure preserves the committed audit and retired voting rights", () => {
  const world = nativeDay();
  const role = world.getComponent(12, COMPONENT.Role)!;
  const failure = new Error("reveal_publication_failed");
  const events: GameEvent[] = [];
  let publications = 0;
  Object.defineProperty(events, "push", {
    value() {
      publications++;
      throw failure;
    },
  });
  expect(() => idiotVotedOutHook(world, 12, events)).toThrow(failure);
  expect(getIdiotState(role)).toEqual({ revealed: true });
  expect(world.getComponent(12, COMPONENT.VotingRight)!.canVote).toBe(false);
  expect(world.getComponent(12, COMPONENT.VotingRight)!.weight).toBe(0);
  expect(world.getComponent(12, COMPONENT.Alive)!.alive).toBe(true);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
  expect(idiotVotedOutHook(world, 12, events)?.reason).toBe("idiot_already_revealed");
  expect(publications).toBe(1);
});
