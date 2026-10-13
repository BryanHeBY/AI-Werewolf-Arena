/**
 * 单元测试用提交的状态印记及明确庇护／反噬声明验证日辉月蚀伤害。手写死因过滤与原守护／救药
 * 断言验证结算，输入及字面／不可变 fixture 预期保持原样，不运行模型或完整对局。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { aliveLifeVersion } from "../../../../src/core/domain/components/alive";
import { StatusMarksComponent } from "../../../../src/core/domain/components/status_marks";
import { DeathCause } from "../../../../src/core/domain/deaths";
import { StatusMark } from "../../../../src/core/domain/identity";
import {
  captureNightLife,
  type NightImmunityClaim,
  type NightRadiantBacklash,
} from "../../../../src/core/domain/night_effects";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import {
  DreamNightFrame,
  type DreamNightLink,
} from "../../../../src/game/mechanisms/roles/dreamer/night_frame";
import type { GameEvent } from "../../../../src/core/domain/events";
import { text } from "@ai-werewolf-arena/game-text";

function bodies() {
  const world = new World();
  for (let index = 0; index < 6; index++)
    world.addComponent(world.createEntity(), COMPONENT.Alive, createAliveComponent());
  const life = (id: number) =>
    world.getComponent<ReturnType<typeof createAliveComponent>>(id, COMPONENT.Alive)!;
  const mark = (id: number, ...values: StatusMark[]) =>
    world.addComponent(id, COMPONENT.StatusMarks, new StatusMarksComponent(values));
  const shelter = (id: number, isCurrent = () => true): NightImmunityClaim => ({
    target: captureNightLife(world, id)!,
    isCurrent,
  });
  const backlash = (id: number, isCurrent = () => true): NightRadiantBacklash => ({
    target: captureNightLife(world, id)!,
    isCurrent,
  });
  const dream = (actorId: number, targetId: number, consecutive = false): DreamNightLink => ({
    actorId,
    targetId,
    day: 2,
    consecutive,
    protectionPolicy: "netease_2026_night_immunity_v1",
    actorLife: life(actorId),
    actorVersion: aliveLifeVersion(life(actorId)),
    targetLife: life(targetId),
    targetVersion: aliveLifeVersion(life(targetId)),
  });
  return { world, life, mark, shelter, backlash, dream };
}

for (const marks of [
  [StatusMark.WolfKillMark],
  [StatusMark.PoisonMark],
  [StatusMark.WolfKillMark, StatusMark.PoisonMark],
  [StatusMark.WolfKillMark, StatusMark.HealMark],
] as const)
  test(`radiant shelter filters the submitted ${marks.join("+")} without guard/heal conflict`, () => {
    const f = bodies();
    f.mark(5, ...marks);
    const result = new DamageResolutionSystem().resolve(f.world, {
      radiantShelters: [f.shelter(5)],
    });
    expect(result).toEqual({ deaths: [], deathSources: {} });
    expect(f.life(5).alive).toBe(true);
    const mark = f.world.getComponent<StatusMarksComponent>(5, COMPONENT.StatusMarks)!;
    for (const value of marks) expect(mark.has(value)).toBe(false);
  });

test("pure radiant backlash enters resolution even without a StatusMarks component", () => {
  const f = bodies();
  const damage = new DamageResolutionSystem().resolve(f.world, {
    radiantBacklashes: [f.backlash(4)],
  });
  expect(damage).toEqual({ deaths: [4], deathSources: { 4: [DeathCause.RadiantBacklash] } });
  expect(f.life(4).alive).toBe(true); // Actual deaths remain owned by DeathResolution.
  expect(text("zh-CN", "death.radiant_backlash")).toBe("流光反噬");
  expect(text("en", "death.radiant_backlash")).toBe("Radiant backlash");
});

test("dream protection filters poison and backlash while caster death leaves only linked Dream", () => {
  const f = bodies();
  f.mark(2, StatusMark.WolfKillMark);
  f.mark(4, StatusMark.PoisonMark);
  const dreams = new DreamNightFrame([f.dream(2, 4)]);
  const damage = new DamageResolutionSystem().resolve(f.world, {
    radiantBacklashes: [f.backlash(4)],
    protectedTargets: dreams.protectedTargets(f.world),
    immuneNightTargets: dreams.immuneNightTargets(f.world),
    consecutiveDeaths: dreams.consecutiveDeaths(f.world),
  });
  expect(damage).toEqual({ deaths: [2], deathSources: { 2: [DeathCause.WolfKill] } });
  dreams.expandInitialDamage(f.world, damage);
  expect(damage).toEqual({
    deaths: [2, 4],
    deathSources: { 2: [DeathCause.WolfKill], 4: [DeathCause.Dream] },
  });
  const events: GameEvent[] = [];
  dreams.recordDeaths(damage.deaths, events);
  expect(events.map((e) => e.payload)).toEqual([
    { actorId: 2, targetId: 4, day: 2, reason: "linked" },
  ]);
});

test("consecutive dream is still lethal when its protection filters independent backlash", () => {
  const f = bodies(),
    dreams = new DreamNightFrame([f.dream(2, 4, true)]);
  const damage = new DamageResolutionSystem().resolve(f.world, {
    radiantBacklashes: [f.backlash(4)],
    protectedTargets: dreams.protectedTargets(f.world),
    consecutiveDeaths: dreams.consecutiveDeaths(f.world),
  });
  expect(damage).toEqual({ deaths: [4], deathSources: { 4: [DeathCause.Dream] } });
});

for (const mode of ["consecutive", "linked", "protected_caster"] as const)
  test(`shelter ${mode} prevents cached dream-death facts and chain expansion`, () => {
    const f = bodies(),
      shelters = [f.shelter(mode === "protected_caster" ? 2 : 5)],
      dreams = new DreamNightFrame([f.dream(2, 5, mode === "consecutive")], shelters);
    if (mode !== "consecutive") f.mark(2, StatusMark.WolfKillMark);
    const damage = new DamageResolutionSystem().resolve(f.world, {
      radiantShelters: shelters,
      consecutiveDeaths: dreams.consecutiveDeaths(f.world),
    });
    dreams.expandInitialDamage(f.world, damage);
    expect(damage).toEqual(
      mode === "linked"
        ? { deaths: [2], deathSources: { 2: [DeathCause.WolfKill] } }
        : { deaths: [], deathSources: {} },
    );
    const events: GameEvent[] = [];
    dreams.recordDeaths([2, 5], events);
    expect(events).toEqual([]);
  });

test("two effective attacks preserve both causes while one target receives one death entry", () => {
  const f = bodies();
  f.mark(4, StatusMark.PoisonMark);
  expect(
    new DamageResolutionSystem().resolve(f.world, { radiantBacklashes: [f.backlash(4)] }),
  ).toEqual({ deaths: [4], deathSources: { 4: [DeathCause.Poison, DeathCause.RadiantBacklash] } });
});

for (const mode of ["revoked", "replacement", "revival"] as const)
  test(`a ${mode} original target cannot reuse shelter for a different life`, () => {
    const f = bodies(),
      claim = f.shelter(5, () => mode !== "revoked");
    if (mode === "replacement") f.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
    if (mode === "revival") {
      f.life(5).alive = false;
      f.life(5).alive = true;
    }
    f.mark(5, StatusMark.WolfKillMark);
    expect(new DamageResolutionSystem().resolve(f.world, { radiantShelters: [claim] })).toEqual({
      deaths: [5],
      deathSources: { 5: [DeathCause.WolfKill] },
    });
  });
