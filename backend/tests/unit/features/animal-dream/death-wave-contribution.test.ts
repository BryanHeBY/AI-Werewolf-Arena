/**
 * 单元测试验证动物死亡贡献的真实运行装配、初／追加提交事实及失败前缀。
 * 输入为既有原体动物 roster、合法手写死因和可观察 World／事件读取；预期来自字面事件与引用。
 * 只调用具体贡献，不推进整局或模型；发布入口不自行标死或授予死亡权限，调用方负责原已提交时点。
 */
import { expect, test } from "bun:test";
import { animalRosterFixture } from "../../../support/features/animal-dream/builders/roster";
import { installAnimalAuthority } from "../../../../src/game/mechanisms/roles/animal_dream/authority";
import { AnimalDeathWavePreparation } from "../../../../src/game/mechanisms/roles/animal_dream/ports";
import { World } from "../../../../src/core/domain/world";
import { Phase, DeathCause, type GameEvent } from "@ai-werewolf-arena/game-contract";

test("an unowned bound contribution preserves list identity without reading events or units", () => {
  const world = new World(),
    trace: string[] = [],
    ids = [1];
  const contribution = AnimalDeathWavePreparation.fromRuntime(
    {
      get world() {
        trace.push("world");
        return world;
      },
      get events(): GameEvent[] {
        throw Error("events_must_not_be_read");
      },
    },
    1,
    {
      get animalUnit(): object {
        throw Error("unit_must_not_be_read");
      },
    },
    () => true,
  );
  expect(contribution.enabled).toBe(false);
  expect(contribution.prepare(ids, {}, Phase.Night)).toBe(ids);
  expect(trace).toEqual(["world"]);
});

test("real bound initial and additional publications preserve role then World/events reads and literal sources", () => {
  const { world } = animalRosterFixture(undefined, installAnimalAuthority),
    events: GameEvent[] = [],
    trace: string[] = [];
  const contribution = AnimalDeathWavePreparation.fromRuntime(
    {
      get world() {
        trace.push("world");
        return world;
      },
      get events() {
        trace.push("events");
        return events;
      },
    },
    2,
    undefined,
    () => true,
  );
  trace.length = 0;
  contribution.recordInitialWave([12], { 12: [DeathCause.WolfKill] }, Phase.Night);
  expect(trace).toEqual(["world", "world", "events", "world", "events"]);
  expect<unknown>(events.map((event) => [event.type, event.payload])).toEqual([
    [
      "animal_puffer_revealed",
      { policy: "awa_animal_dream_v1", day: 2, actorId: 12, reason: "knife_death" },
    ],
    [
      "animal_wave_committed",
      {
        policy: "awa_animal_dream_v1",
        day: 2,
        phase: "night",
        deaths: [12],
        deathSources: { 12: ["wolf_kill"] },
      },
    ],
  ]);
  trace.length = 0;
  contribution.recordAdditionalDeath(5, { 5: [DeathCause.PufferRetaliation] }, Phase.Day);
  expect(trace).toEqual(["world", "events"]);
  expect(events[2]?.payload).toEqual({
    policy: "awa_animal_dream_v1",
    day: 2,
    phase: "day",
    deaths: [5],
    deathSources: { 5: ["puffer_retaliation"] },
  });
});

test("a later event-read failure retains the already published puffer fact", () => {
  const { world } = animalRosterFixture(undefined, installAnimalAuthority),
    events: GameEvent[] = [];
  const failure = Error("literal_second_publication_failed");
  let reads = 0;
  const contribution = AnimalDeathWavePreparation.fromRuntime(
    {
      get world() {
        return world;
      },
      get events() {
        if (++reads === 2) throw failure;
        return events;
      },
    },
    2,
    undefined,
    () => true,
  );
  expect(() =>
    contribution.recordInitialWave([12], { 12: [DeathCause.WolfKill] }, Phase.Night),
  ).toThrow(failure);
  expect(events.map((event) => event.type)).toEqual(["animal_puffer_revealed"]);
  expect(events[0]?.payload).toEqual({
    policy: "awa_animal_dream_v1",
    day: 2,
    actorId: 12,
    reason: "knife_death",
  });
});
