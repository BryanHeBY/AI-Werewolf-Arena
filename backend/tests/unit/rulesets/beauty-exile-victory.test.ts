/**
 * 单元测试验证狼美人放逐候选的原晚读、实际牵连及有序屠边覆盖边界。
 * 输入是测试自有 World、真实关系／生命引用和明确 getter；输出以字面顺序、成员、拒绝与同引用验收。
 * 候选在死亡波前捕获，applied 和原体复验才支持结果；条件顺序及唯一封盘不由候选代替。
 * 规则依据 docs/rules/awa-wolf-beauty-v1.md；不运行完整阶段、模型或网络，预期不从生产结果生成。
 */
import { expect, test } from "bun:test";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createRoleComponent } from "../../../src/domain/components/role";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { createVictoryComponent } from "../../../src/domain/components/victory";
import { Camp, Role, DeathCause, WinCondition, type WinDecision } from "../../../src/domain/model";
import { ConditionRegistry } from "../../../src/domain/registries/condition-registry";
import { bindCharm } from "../../../src/game/mechanisms/roles/wolf_beauty/relation";
import { activeCharm, attemptCharmTrigger, commitCharmDeath, setWolfBeautyState, type CharmClaimReceipt } from "../../../src/game/mechanisms/roles/wolf_beauty/ports";
import { prepareBeautyExileVictory, resolveBeautyExileVictory, beautyExileVictoryOverrides } from "../../../src/rulesets/beauty-exile-victory";

function fixture() {
  const world = new World(), actor = world.createEntity(), target = world.createEntity(), other = world.createEntity();
  const actorRole = createRoleComponent(Role.WolfBeauty),
    targetRole = createRoleComponent(Role.Villager);
  setWolfBeautyState(actorRole, { targetId: target, lastActedDay: 1, history: [], deathLinkPolicy: "awa_exile_poison_v1" });
  world.addComponent(actor, COMPONENT.Role, actorRole);
  world.addComponent(actor, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(target, COMPONENT.Role, targetRole);
  world.addComponent(target, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(other, COMPONENT.Role, createRoleComponent(Role.Seer));
  world.addComponent(other, COMPONENT.Camp, { camp: Camp.Good });
  const actorLife = createAliveComponent(), targetLife = createAliveComponent();
  world.addComponent(actor, COMPONENT.Alive, actorLife);
  world.addComponent(target, COMPONENT.Alive, targetLife);
  world.addComponent(other, COMPONENT.Alive, createAliveComponent());
  world.addComponent(actor, COMPONENT.Victory, createVictoryComponent([{ kind: "faction", faction: Camp.Wolf }]));
  world.addComponent(target, COMPONENT.Victory, createVictoryComponent([{ kind: "faction", faction: Camp.Good }]));
  // 这名 Good 角色的独立胜利归属属于 Wolf；不能从 Role.camp 反推成员。
  world.addComponent(other, COMPONENT.Victory, createVictoryComponent([{ kind: "faction", faction: Camp.Wolf }]));
  bindCharm(world, actor, target);
  return { world, actor, target, other, actorRole, targetRole, actorLife, targetLife, binding: activeCharm(world, actor)! };
}

test("effective exile reads twice before membership and World, while rejected targets never capture", () => {
  const f = fixture(), trace: string[] = [], removed = [f.actor];
  Object.defineProperty(removed, "includes", { configurable: true, get() { trace.push("includes"); return Array.prototype.includes; } });
  const selection = {
    get summary() {
      trace.push("summary");
      return { get effectiveTarget() { trace.push("effective"); return f.actor; }, target: f.target };
    },
    get removed() { trace.push("removed"); return removed; },
  };
  const captured = prepareBeautyExileVictory(selection, () => { trace.push("world"); return f.world; });
  expect(trace).toEqual(["summary", "effective", "summary", "effective", "removed", "includes", "world"]);
  expect(captured.target).toBe(f.actor);
  expect(captured.candidate?.binding).toBe(f.binding);
  expect(captured.candidate?.side).toBe("villager");
  for (const target of [null, f.other]) {
    const refused = prepareBeautyExileVictory({ summary: { target }, removed: [f.actor] }, () => { throw new Error("literal_unselected_world_must_not_read"); });
    expect(refused.target).toBe(target);
    expect(refused.candidate).toBeNull();
  }
  const failure = new Error("literal_membership_lookup_failure");
  Object.defineProperty(removed, "includes", { get() { throw failure; } });
  expect(() => prepareBeautyExileVictory(selection, () => { throw new Error("literal_world_must_follow_membership"); })).toThrow(failure);
  expect(f.binding.resolved).toBe(false);
});

test("only applied actual charm death produces the captured side and real Victory members", () => {
  const f = fixture(), { candidate } = prepareBeautyExileVictory({ summary: { target: f.actor }, removed: [f.actor] }, () => f.world);
  expect(resolveBeautyExileVictory(f.world, candidate)).toBeNull();
  f.actorLife.alive = false;
  const claim = attemptCharmTrigger(f.binding, { [f.actor]: [DeathCause.Exile] }, new Set(), new Set([f.actor]), () => f.world, () => false)!;
  f.targetLife.alive = false;
  expect(resolveBeautyExileVictory(f.world, candidate)).toBeNull();
  expect(commitCharmDeath(f.world, claim as CharmClaimReceipt)?.kind).toBe("applied");
  // 目标侧在波前已捕获；波后牌面变化不重新生成候选，关系仍按原生命／来源复验。
  f.targetRole.role = Role.Guard;
  const result = resolveBeautyExileVictory(f.world, candidate);
  expect(result as unknown).toEqual({
    winner: "wolf", reason: "wolf_beauty_last_exile",
    outcome: {
      kind: "victory", primary: { kind: "faction", faction: "wolf", winningPlayerIds: [1, 3] },
      additional: [], winningPlayerIds: [1, 3],
    },
  });
  expect(candidate?.binding).toBe(f.binding);
  expect(candidate?.side).toBe("villager");
});

test("side override obeys condition order and resurrection revokes a paid candidate without refund", () => {
  const f = fixture(), { candidate } = prepareBeautyExileVictory({ summary: { target: f.actor }, removed: [f.actor] }, () => f.world);
  f.actorLife.alive = false;
  const claim = attemptCharmTrigger(f.binding, { [f.actor]: [DeathCause.Exile] }, new Set(), new Set([f.actor]), () => f.world, () => false)!;
  f.targetLife.alive = false;
  commitCharmDeath(f.world, claim as CharmClaimReceipt);
  const beauty = resolveBeautyExileVictory(f.world, candidate)!, overrides = beautyExileVictoryOverrides(beauty), trace: string[] = [];
  const ordinary: WinDecision = { winner: Camp.Good, reason: "literal_city_first", outcome: { kind: "victory", primary: { kind: "faction", faction: "good", winningPlayerIds: [2] }, additional: [], winningPlayerIds: [2] } };
  const registry = new ConditionRegistry({ evaluate(_world, condition, checkpoint) { trace.push(`${condition}:${checkpoint}`); return ordinary; } });
  expect(Object.keys(overrides)).toEqual(["slaughter_side"]);
  expect(overrides[WinCondition.SlaughterSide]).toBe(beauty);
  expect(registry.evaluateMany(f.world, [WinCondition.SlaughterCity, WinCondition.SlaughterSide], "exile_settled", overrides)).toBe(ordinary);
  expect(trace).toEqual(["slaughter_city:exile_settled"]);
  trace.length = 0;
  expect(registry.evaluateMany(f.world, [WinCondition.SlaughterSide, WinCondition.SlaughterCity], "exile_settled", overrides)).toBe(beauty);
  expect(trace).toEqual([]);
  expect(beautyExileVictoryOverrides(null)).toEqual({});
  f.targetLife.alive = true;
  f.targetLife.alive = false;
  expect(resolveBeautyExileVictory(f.world, candidate)).toBeNull();
  expect(f.binding.resolved).toBe(true);
  expect(f.binding.applied).toBe(true);
});
