/**
 * 负责新死亡提案原生命末核的单元测试。独立字面反例在旧查询末端换body／改版本，断言首Alive写之前拒绝；
 * 旧plan不新增World读取的兼容预期固定写出，不从另一次执行生成oracle。
 */
import { expect, test } from "bun:test";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent, aliveLifeVersion } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { Camp, Role, Phase, DeathCause } from "@ai-werewolf-arena/game-contract";
import { DeathCommitter } from "../../../../src/engine/death-committer";
import { planDeathWave, bindDeathWaveOriginalLives } from "../../../../src/engine/death-wave";
function fixture() {
  const world = new World();
  world.createEntity();
  const life = createAliveComponent();
  world.addComponent(1, COMPONENT.Alive, life);
  world.addComponent(1, COMPONENT.Role, createRoleComponent(Role.Villager));
  world.addComponent(1, COMPONENT.Camp, { camp: Camp.Good });
  const ids = [1],
    sources = { 1: [DeathCause.Exile] },
    scope = { life, version: aliveLifeVersion(life)! };
  const plan = planDeathWave(ids, sources, "initial"),
    events: never[] = [];
  return { world, life, ids, sources, scope, plan, events };
}
for (const mode of ["body", "revive", "descriptor"] as const)
  test(`新plan原全部查询后${mode}撤权零新死亡`, () => {
    const f = fixture();
    bindDeathWaveOriginalLives(f.plan, f.world, new Map([[1, f.scope]]));
    const replacement = createAliveComponent();
    let reads = 0;
    const committer = new DeathCommitter({
      get world() {
        reads++;
        // 原序第一读取得Alive，第二读isSettledLife，第三读WildChild检查；在其末端撤换。
        if (reads === 3) {
          if (mode === "body") f.world.addComponent(1, COMPONENT.Alive, replacement);
          else if (mode === "revive") {
            f.life.alive = false;
            f.life.alive = true;
          } else Object.defineProperty(f.life, "alive", { value: true, writable: true });
        }
        return f.world;
      },
      events: f.events,
      state: { day: 1, phase: Phase.Voting, gameOver: false, result: null },
    });
    expect(() =>
      committer.markPlayersDead(f.ids, false, [], false, f.sources, undefined, f.plan),
    ).toThrow("death_wave_original_life_revoked");
    expect(f.life.alive).toBe(true);
    expect(replacement.alive).toBe(true);
    expect(f.events).toEqual([]);
  });
test("新plan拒绝晚查询返回的另World，即使共享同一个Alive也不是原World", () => {
  const f = fixture(),
    other = new World();
  other.createEntity();
  other.addComponent(1, COMPONENT.Alive, f.life);
  other.addComponent(1, COMPONENT.Role, createRoleComponent(Role.Villager));
  bindDeathWaveOriginalLives(f.plan, f.world, new Map([[1, f.scope]]));
  let count = 0;
  const committer = new DeathCommitter({
    get world() {
      return ++count >= 3 ? other : f.world;
    },
    events: f.events,
    state: { day: 1, phase: Phase.Day, gameOver: false, result: null },
  });
  expect(() =>
    committer.markPlayersDead(f.ids, false, [], false, f.sources, undefined, f.plan),
  ).toThrow("death_wave_original_life_revoked");
  expect(f.life.alive).toBe(true);
});
test("旧plan读取仍原序三次前检，成功提交不因缺少新metadata被拒绝", () => {
  const f = fixture();
  let reads = 0;
  const committer = new DeathCommitter({
    get world() {
      reads++;
      return f.world;
    },
    events: f.events,
    state: { day: 1, phase: Phase.Day, gameOver: false, result: null },
  });
  committer.markPlayersDead(f.ids, false, [], false, f.sources, undefined, f.plan);
  expect(f.life.alive).toBe(false);
  // 固定旧最小Villager路径：Alive／settled／WildChild／Animal／Noble／role／guns／lucky。
  expect(reads).toBe(8);
});
test("绑定计划与scope不可伪造或覆盖；真实revisit只准同原体首次死亡版本", () => {
  const f = fixture(),
    scopes = new Map([[1, f.scope]]);
  expect(() => bindDeathWaveOriginalLives({ ...f.plan }, f.world, scopes)).toThrow(
    "death_wave_original_lives_invalid",
  );
  bindDeathWaveOriginalLives(f.plan, f.world, scopes);
  expect(() => bindDeathWaveOriginalLives(f.plan, f.world, scopes)).toThrow(
    "death_wave_original_lives_invalid",
  );
  scopes.set(1, { life: createAliveComponent(), version: 0 });
  const committer = new DeathCommitter({
    world: f.world,
    events: f.events,
    state: { day: 1, phase: Phase.Day, gameOver: false, result: null },
  });
  committer.markPlayersDead(f.ids, false, [], false, f.sources, undefined, f.plan);
  const revisit = planDeathWave(f.ids, f.sources, "revisit");
  bindDeathWaveOriginalLives(revisit, f.world, new Map([[1, f.scope]]));
  expect(() =>
    committer.markPlayersDead(f.ids, false, [], false, f.sources, undefined, revisit),
  ).not.toThrow();
  f.life.alive = true;
  f.life.alive = false;
  expect(() =>
    committer.markPlayersDead(f.ids, false, [], false, f.sources, undefined, revisit),
  ).toThrow("death_wave_original_life_revoked");
});
