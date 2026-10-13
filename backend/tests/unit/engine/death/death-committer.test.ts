/**
 * 单元测试验证原生命结算所有权与死亡提交失败前缀。输入是内存 World、原 Alive 引用、
 * 字面玩家序号及注入的枪列表或继承异常；独立手写的事件数量、生命身份和已结算断言
 * 作为预期，不由另一场对局生成。本测试不推进阶段，不请求遗言、警徽、模型或完整游戏。
 */
import { expect, test } from "bun:test";
import { DeathCommitter } from "../../../../src/game/engine/death-committer";
import { World } from "../../../../src/core/domain/world";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import { createRoleComponent } from "../../../../src/core/domain/components/role";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import {
  Camp,
  Phase,
  Role,
  type GameEvent,
  type RuntimeSnapshot,
} from "../../../../src/core/domain/model";
import type { firstDeathGuns } from "../../../../src/game/mechanisms/roles/death_abilities";

function fixture() {
  const world = new World("en"),
    id = world.createEntity(),
    life = createAliveComponent(),
    events: GameEvent[] = [],
    state: RuntimeSnapshot = { day: 1, phase: Phase.Day, gameOver: false, result: null };
  world.addComponent(id, COMPONENT.Alive, life);
  world.addComponent(id, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good));
  const reads: string[] = [],
    committer = new DeathCommitter({
      get world() {
        reads.push("world");
        return world;
      },
      get events() {
        reads.push("events");
        return events;
      },
      get state() {
        reads.push("state");
        return state;
      },
    });
  return { world, id, life, events, reads, committer };
}

test("the sole ledger follows the original life version and reference without bind-time reads", () => {
  const f = fixture();
  expect(f.reads).toEqual([]);
  expect(f.committer.isSettledLife(f.id)).toBe(false);
  expect(f.reads).toEqual(["world"]);
  f.committer.markPlayersDead([f.id], false, [], true);
  expect(f.life.alive).toBe(false);
  expect(f.committer.isSettledLife(f.id)).toBe(true);
  f.committer.markPlayersDead([f.id], false, [], true);
  expect(f.events.map((event) => event.type)).toEqual(["player_role_revealed"]);
  f.life.alive = true;
  expect(f.committer.isSettledLife(f.id)).toBe(false);
  f.committer.markPlayersDead([f.id], false, [], true);
  const replacement = createAliveComponent(false);
  f.world.addComponent(f.id, COMPONENT.Alive, replacement);
  expect(f.committer.isSettledLife(f.id)).toBe(false);
  f.committer.markPlayersDead([f.id], false, [], true);
  expect(f.committer.isSettledLife(f.id)).toBe(true);
  expect(f.world.getComponent(f.id, COMPONENT.Alive)).toBe(replacement);
  expect(f.events.map((event) => event.payload)).toEqual([
    { playerId: f.id, role: Role.Villager },
    { playerId: f.id, role: Role.Villager },
    { playerId: f.id, role: Role.Villager },
  ]);
});

test("a gun-list append failure preserves death and reveal but does not publish a settled ledger entry", () => {
  const f = fixture(),
    guns: ReturnType<typeof firstDeathGuns> = [];
  guns.push = () => {
    throw new Error("test_gun_list_append_failed");
  };
  expect(() => f.committer.markPlayersDead([f.id], false, guns, true)).toThrow(
    "test_gun_list_append_failed",
  );
  expect(f.life.alive).toBe(false);
  expect(f.events.map((event) => event.type)).toEqual(["player_role_revealed"]);
  expect(f.committer.isSettledLife(f.id)).toBe(false);
  f.committer.markPlayersDead([f.id], false, [], true);
  expect(f.committer.isSettledLife(f.id)).toBe(true);
  expect(f.events.map((event) => event.type)).toEqual([
    "player_role_revealed",
    "player_role_revealed",
  ]);
});

test("an inheritance failure occurs after original death and ledger commit", () => {
  const f = fixture();
  f.world.getAliveEntityIds = () => {
    throw new Error("test_inheritance_roster_failed");
  };
  expect(() => f.committer.markPlayersDead([f.id])).toThrow("test_inheritance_roster_failed");
  expect(f.life.alive).toBe(false);
  expect(f.committer.isSettledLife(f.id)).toBe(true);
  expect(f.events).toEqual([]);
});
