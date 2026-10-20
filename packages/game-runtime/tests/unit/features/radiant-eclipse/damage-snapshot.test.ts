/**
 * 单元测试验证 radiant-eclipse 的独立 damage-snapshot.test 契约。输入为既有内存 fixture、原回调控制和明确非法
 * 修改；原字面预期、身份快照及拒绝断言是预期，不在迁移中重新生成。仅调用原生内存
 * owner／frame／reader，测试自有 mock／组件不运行完整对局、模型或真实传输，support／fixture 字节及政策状态不变。
 */
import { bindDreamLifeQueries } from "../../../../src/domain/dream-night-effects";
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { aliveLifeVersion } from "../../../../src/domain/components/alive";
import { captureNightLife, type NightImmunityClaim } from "../../../../src/domain/night-effects";
import { DreamNightFrame, type DreamNightLink } from "../../../../src/features/dreamer/night-frame";
function fixture() {
  const world = new World();
  for (let n = 0; n < 5; n++)
    world.addComponent(world.createEntity(), COMPONENT.Alive, createAliveComponent());
  const body = (n: number) => world.getComponent(n, COMPONENT.Alive)!;
  const scope = (n: number) => captureNightLife(world, n)!;
  const link: DreamNightLink = {
    actorId: 2,
    targetId: 4,
    day: 2,
    consecutive: true,
    actorLife: body(2),
    targetLife: body(4),
    actorVersion: aliveLifeVersion(body(2)),
    targetVersion: aliveLifeVersion(body(4)),
  };
  return { world, body, scope, link };
}
test("adding to the caller's readonly-compatible array cannot authorize a new shelter in a captured frame", () => {
  const f = fixture(),
    claims: NightImmunityClaim[] = [],
    frame = new DreamNightFrame([f.link], claims);
  claims.push({ target: f.scope(4), isCurrent: () => true });
  expect(frame.consecutiveDeaths(bindDreamLifeQueries(f.world))).toEqual([4]);
});
test("clearing the caller's array cannot remove a shelter already captured by a frame", () => {
  const f = fixture(),
    claims: NightImmunityClaim[] = [{ target: f.scope(4), isCurrent: () => true }],
    frame = new DreamNightFrame([f.link], claims);
  claims.length = 0;
  expect(frame.consecutiveDeaths(bindDreamLifeQueries(f.world))).toEqual([]);
});
test("a mutable source claim cannot move captured shelter to another original body", () => {
  const f = fixture(),
    claim = { target: f.scope(4), isCurrent: () => true },
    frame = new DreamNightFrame([f.link], [claim]);
  claim.target = f.scope(5);
  expect(frame.consecutiveDeaths(bindDreamLifeQueries(f.world))).toEqual([]);
});
test("valid claim method keeps its receiver in the Dream filter as it does in damage resolution", () => {
  const f = fixture();
  const claim: NightImmunityClaim = {
    target: f.scope(4),
    isCurrent() {
      return this.target.id === 4;
    },
  };
  const frame = new DreamNightFrame([f.link], [claim]);
  expect(frame.consecutiveDeaths(bindDreamLifeQueries(f.world))).toEqual([]);
});
test("captured authorization callback stays live, not an eagerly cached boolean", () => {
  const f = fixture();
  let current = true;
  const frame = new DreamNightFrame([f.link], [{ target: f.scope(4), isCurrent: () => current }]);
  current = false;
  expect(frame.consecutiveDeaths(bindDreamLifeQueries(f.world))).toEqual([4]);
});
test("shelter follows eligible original first death, but never same-body revival", () => {
  const f = fixture(),
    frame = new DreamNightFrame([f.link], [{ target: f.scope(4), isCurrent: () => true }]);
  f.body(4).alive = false;
  expect(frame.linkedDeaths(bindDreamLifeQueries(f.world), [2], new Set([4]))).toEqual([]);
  f.body(4).alive = true;
  expect(frame.linkedDeaths(bindDreamLifeQueries(f.world), [2], new Set([4]))).toEqual([]);
});
