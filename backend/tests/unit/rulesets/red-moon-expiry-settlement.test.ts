/**
 * 单元测试负责赤月到期组合的短路、原候选引用与死亡后失败前缀。
 * 输入为真实猎魔名单／到期库存和字面查询轨迹，输出为独立写明的读取、yield、生命、审计及事件断言。
 * 不替代原资源权威，不执行完整对局；测试手动标死仅模拟经理已完成的死亡边界。
 */
import { expect, test } from "bun:test";
import { Camp, type GameEvent, type WinDecision } from "../../../src/core/domain/model";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { World } from "../../../src/core/domain/world";
import { ConditionRegistry } from "../../../src/core/domain/registries/condition_registry";
import { getRedMoonState } from "../../../src/game/mechanisms/roles/red_moon_apostle/ports";
import {
  beginDemonHunterNight,
  closeDemonHunterNight,
  freezeDemonHunt,
  commitDemonRedMoonTransition,
  demonHunterCheckpointPlayers,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
import { settleRedMoonExpiry, type RedMoonExpiryRuntime } from "../../../src/rulesets/red-moon-expiry-settlement";
import { redMoonCandidateWorld } from "../../support/features/red-moon/builders/candidate-world";

function deferred() {
  const fixture = redMoonCandidateWorld();
  beginDemonHunterNight(fixture.world, 1, () => true);
  freezeDemonHunt(fixture.world);
  closeDemonHunterNight(fixture.world);
  for (const id of [1, 2, 3, 11]) fixture.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  if (!commitDemonRedMoonTransition(fixture.world, 4, "exile", 1)) throw new Error("literal_deferred_fixture_failed");
  beginDemonHunterNight(fixture.world, 2, () => true);
  freezeDemonHunt(fixture.world);
  return fixture;
}

test("没有原生板子不读World，没有到期者不读registry或配置", () => {
  let worldReads = 0;
  const world = new World();
  const runtime: RedMoonExpiryRuntime = {
    get world() { worldReads++; return world; },
    get registry(): never { throw new Error("literal_registry_must_not_read"); },
    get config(): never { throw new Error("literal_config_must_not_read"); },
    get events(): never { throw new Error("literal_events_must_not_read"); },
    get checkpoint(): never { throw new Error("literal_checkpoint_must_not_read"); },
  };
  expect(settleRedMoonExpiry(runtime, false, 2).next()).toEqual({ done: true, value: null });
  expect(worldReads).toBe(0);
  expect(settleRedMoonExpiry(runtime, true, 2).next()).toEqual({ done: true, value: null });
  expect(worldReads).toBe(1);
});

test("到期前已胜候选保原引用、三参数评估及晚读取，不请求死亡或提交", () => {
  const f = deferred(), trace: string[] = [];
  const candidate: WinDecision = {
    winner: Camp.Wolf,
    reason: "literal_before_expiry_win",
    outcome: { kind: "victory", primary: { kind: "faction", faction: Camp.Wolf, winningPlayerIds: [4] }, additional: [], winningPlayerIds: [4] },
  };
  const registry = new ConditionRegistry({ evaluate: () => candidate });
  const evaluateMany = registry.evaluateMany;
  Object.defineProperty(registry, "evaluateMany", {
    get() {
      trace.push("callee");
      return function (this: ConditionRegistry, ...args: Parameters<ConditionRegistry["evaluateMany"]>) {
        expect(this).toBe(registry);
        expect(args).toHaveLength(3);
        expect(args[0]).toBe(f.world);
        expect(args[1]).toBe(f.config.winConditions!);
        expect(args[2]).toBe("night_settled");
        return evaluateMany.apply(this, args);
      };
    },
  });
  const step = settleRedMoonExpiry({
    get world() { trace.push("world"); return f.world; },
    get registry() { trace.push("registry"); return registry; },
    get config() { trace.push("config"); return f.config; },
    get checkpoint(): "night_settled" { trace.push("checkpoint"); return "night_settled"; },
    get events(): never { throw new Error("literal_events_must_not_read_for_winner"); },
  }, true, 2).next();
  expect(step.done).toBe(true);
  expect(step.value).toBe(candidate);
  expect(trace).toEqual(["world", "registry", "callee", "world", "world", "config", "config", "config", "checkpoint"]);
  expect(f.world.getComponent(4, COMPONENT.Alive)!.alive).toBe(true);
  expect(getRedMoonState(f.world.getComponent(4, COMPONENT.Role), () => f.world.getComponent(4, COMPONENT.Camp))!.expirySettled).toBe(false);
});

test("暂停后先核真实死亡，事件失败保已提交到期和原审计且不恢复生命", () => {
  for (const markedDead of [false, true]) {
    const f = deferred(), events: GameEvent[] = [];
    const failure = new Error("literal_expiry_event_failed");
    let publications = 0;
    Object.defineProperty(events, "push", {
      value() { publications++; throw failure; },
    });
    const settlement = settleRedMoonExpiry({
      world: f.world, events, config: f.config, checkpoint: "night_settled",
      registry: new ConditionRegistry({ evaluate: () => null }),
    }, true, 2);
    expect(settlement.next()).toEqual({ done: false, value: 4 });
    expect(getRedMoonState(f.world.getComponent(4, COMPONENT.Role), () => f.world.getComponent(4, COMPONENT.Camp))!.expirySettled).toBe(false);
    if (markedDead) f.world.getComponent(4, COMPONENT.Alive)!.alive = false;
    expect(() => settlement.next()).toThrow(markedDead ? failure : "red_moon_expiry_death_unsettled");
    expect(getRedMoonState(f.world.getComponent(4, COMPONENT.Role), () => f.world.getComponent(4, COMPONENT.Camp))!.expirySettled).toBe(markedDead);
    expect(f.world.getComponent(4, COMPONENT.Alive)!.alive).toBe(!markedDead);
    expect(publications).toBe(markedDead ? 1 : 0);
    expect(events).toEqual([]);
    expect(demonHunterCheckpointPlayers(f.world, true)).toHaveLength(12);
  }
});
