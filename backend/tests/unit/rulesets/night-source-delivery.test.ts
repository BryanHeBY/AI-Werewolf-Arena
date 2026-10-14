/**
 * 单元测试验证完整夜间来源交付的封存失败前缀、原数组身份与伤害清印记之后的晚守护查询。
 * 输入为真实猎魔安装、原 mark／生命贡献和独立手写 getter；输出以字面错误、引用和读序验收。
 * 封存不等于新行动许可，复制投票者不复制角色或原体；运行 token 与闭包不进入 JSON／玩家 DTO。
 * 只执行必要同步组合与原伤害清印记，不请求行动、付款、运行整局或调用模型。
 */
import { expect, test } from "bun:test";
import { StatusMark } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { aliveLifeVersion } from "../../../src/core/domain/components/alive";
import { StatusMarksComponent, statusMarkSnapshot } from "../../../src/core/domain/components/status_marks";
import { captureNightLife, type NightGuardClaim } from "../../../src/core/domain/night_effects";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { demonHunterFixture } from "../../support/features/demon-hunter/builders/candidate-world";
import { beginDemonHunterNight, closeDemonHunterNight } from "../../../src/game/mechanisms/roles/demon_hunter/authority";
import { openNativeGuardContribution, commitNativeGuardContribution, sealNativeGuardContribution } from "../../../src/game/mechanisms/roles/demon_hunter/guard_contribution";
import { sealDeliveredDemonWitchSources } from "../../../src/game/mechanisms/roles/demon_hunter/native_potion_controller";
import { prepareNightSourceDelivery, type NightSourceDeliveryRuntime } from "../../../src/rulesets/night-source-delivery";
import { composeNightDamage } from "../../../src/rulesets/night-damage-composition";
import type { NightStageState } from "../../../src/game/mechanisms/stages/night/contracts";

type Claims = ReturnType<NightSourceDeliveryRuntime["claims"]>;
function pendingNight() {
  const f = demonHunterFixture();
  // 原女巫在开夜前已死亡，该夜原权威不要求行动交付；不伪造 poison/proof 或绕过 token 登记。
  f.world.getComponent(f.witchId, COMPONENT.Alive)!.alive = false;
  beginDemonHunterNight(f.world, 1, () => true);
  return f;
}
function state(claims: Claims): NightStageState {
  return { wolfChatOrder: [], endedWolves: new Set(), wolfVotes: {}, wolfTarget: 3, seerChecks: [], ...claims };
}
function guard(world: World, initialUnknown = false): NightGuardClaim {
  const marks = world.getComponent(3, COMPONENT.StatusMarks)!;
  if (initialUnknown) marks.add(StatusMark.GuardMark);
  const contribution = openNativeGuardContribution(world, 3, marks);
  marks.add(StatusMark.GuardMark);
  commitNativeGuardContribution(contribution);
  return { contribution, marks, target: captureNightLife(world, 3)!, isCurrent: () => false };
}

test("ordinary night still reads voters and scope before the remaining ownership checks", () => {
  const trace: string[] = [], world = new World(), failure = new Error("literal_voter_iterator_failure");
  let failing = false;
  const voters = [] as number[];
  Object.defineProperty(voters, Symbol.iterator, { get() { trace.push("iterator"); if (failing) throw failure; return Array.prototype[Symbol.iterator]; } });
  const claims: Claims = {
    get wolfTargetVoters() { trace.push("voters"); return voters; },
    get wolfTargetScope() { trace.push("scope"); return undefined; },
    get guardClaims(): Claims["guardClaims"] { throw new Error("ordinary_guard_claims_must_not_read"); },
  };
  const runtime: NightSourceDeliveryRuntime = {
    ownsDemon() { trace.push("owns"); return false; },
    world() { throw new Error("ordinary_world_must_not_read"); },
    day() { throw new Error("ordinary_day_must_not_read"); },
    claims() { trace.push("claims"); return claims; },
  };
  expect(prepareNightSourceDelivery(runtime)).toEqual({ demonSources: undefined, demonWolfSourceCurrent: undefined, demonKnifeProtection: undefined });
  expect(trace).toEqual(["owns", "claims", "voters", "iterator", "claims", "scope", "owns", "owns", "owns"]);
  failing = true; trace.length = 0;
  expect(() => prepareNightSourceDelivery(runtime)).toThrow(failure);
  expect(trace).toEqual(["owns", "claims", "voters", "iterator"]);
  expect(world.entityIds()).toEqual([]);
});

test("a second guard seal failure preserves the Witch token and first guard sealed prefix", () => {
  const f = pendingNight(), first = guard(f.world);
  const claims: Claims = { wolfTargetVoters: [1], guardClaims: [first, { ...first, contribution: {} }] };
  try {
    expect(() => prepareNightSourceDelivery({ ownsDemon: () => true, world: () => f.world, day: () => 1, claims: () => claims })).toThrow("demon_hunter_guard_mark_seal_invalid");
    expect(() => sealNativeGuardContribution(first.contribution!)).toThrow("demon_hunter_guard_mark_seal_invalid");
    expect(() => sealDeliveredDemonWitchSources(f.world, 1)).toThrow("demon_hunter_native_sources_already_sealed");
    expect(statusMarkSnapshot(first.marks, StatusMark.GuardMark)?.present).toBe(true);
    expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 6]);
  } finally {
    closeDemonHunterNight(f.world);
  }
});

test("sealed unknown and later independent guards survive native revocation after ordinary damage clears marks", () => {
  for (const variant of ["native", "unknown_before", "late_unknown"] as const) {
    const f = pendingNight(), claim = guard(f.world, variant === "unknown_before"), voters = [1];
    const marks = claim.marks;
    marks.add(StatusMark.WolfKillMark);
    const life = f.world.getComponent(3, COMPONENT.Alive)!;
    const claims = state({ wolfTargetVoters: voters, wolfTargetScope: { targetId: 3, life, version: aliveLifeVersion(life)!, marks }, guardClaims: [claim] });
    const trace: string[] = [];
    let currentWorld = f.world;
    try {
      const delivery = prepareNightSourceDelivery({ ownsDemon: () => true, world() { trace.push("world"); return currentWorld; }, day() { trace.push("day"); return 1; }, claims: () => claims });
      expect(Object.isFrozen(delivery.demonKnifeProtection)).toBe(true);
      expect(delivery.demonKnifeProtection).toMatchObject({ targetId: 3, wolf: true, guard: true, heal: false });
      // 后续投票数组变更不改变原投票者副本；World 与原体查询仍在闭包调用时执行。
      voters.push(3); trace.length = 0;
      expect(delivery.demonWolfSourceCurrent!(3)).toBe(true);
      expect(trace).toEqual(["world", "day", "world", "day"]);
      trace.length = 0;
      expect(delivery.demonWolfSourceCurrent!(4)).toBe(false);
      expect(trace).toEqual([]);
      currentWorld = new World();
      expect(delivery.demonWolfSourceCurrent!(3)).toBe(false);
      currentWorld = f.world;
      const damage = new DamageResolutionSystem();
      composeNightDamage({ ownsRadiant: () => false, world: () => f.world, day: () => 1, claims: () => claims, config: () => ({}), stageContext() { throw new Error("ordinary_stage_context_must_not_read"); }, solver: () => damage, aliveByRole: () => [] });
      expect(statusMarkSnapshot(marks, StatusMark.GuardMark)?.present).toBe(false);
      if (variant === "late_unknown") marks.add(StatusMark.GuardMark);
      // 原生当前性已为 false；独立来源不能据此撤销，最终布尔预期来自固定三种输入。
      expect(delivery.demonKnifeProtection!.guardCurrent!()).toBe(variant !== "native");
      expect(claims.guardClaims![0]).toBe(claim);
      expect(claims.wolfTargetScope!.marks).toBe(marks);
    } finally {
      closeDemonHunterNight(f.world);
    }
  }
});
