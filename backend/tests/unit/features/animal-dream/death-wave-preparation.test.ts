/**
 * 单元测试验证动物梦境死亡波准备的过滤、事实、原因删除和到期失败前缀。
 * 输入为字面过滤结果、原 unit 引用及有序端口；手写名单、原因和 getter 序列是独立预期。
 * 这里模拟已验证端口的结果，不赋予伪造 unit 实际权威权限，也不运行 World、模型或完整对局。
 */
import { expect, test } from "bun:test";
import { AnimalDeathWavePreparation } from "../../../../src/game/mechanisms/roles/animal_dream/death-wave";
import { Phase, DeathCause, type DeathSources } from "../../../../src/domain/model";

type Ports = ConstructorParameters<typeof AnimalDeathWavePreparation>[4];
function fixture(failure?: "expiry" | "first_fact") {
  const trace: string[] = [],
    facts: Array<{ type: string; payload: unknown }> = [];
  const unit = {
    expiryPrepared: false,
    get number() {
      trace.push("number");
      return 3;
    },
    get kind() {
      trace.push("kind");
      return "night" as const;
    },
  };
  const nightEffects = {
    get animalUnit() {
      trace.push("unit");
      return unit;
    },
  };
  const ports: Ports = {
    filter(_day, _phase, _ids, _sources, scope) {
      trace.push("filter-world");
      expect(scope()).toBe(unit);
      return { deaths: [], blockedCatId: 9, revealedCatId: 9 };
    },
    authority() {
      trace.push("authority");
      return { unit } as unknown as ReturnType<Ports["authority"]>;
    },
    prepareExpiry(readUnit) {
      trace.push("expiry-world");
      expect(readUnit()).toBe(unit);
      if (failure === "expiry") throw Error("test_expiry_failed");
      return 9;
    },
    appendFact(type, payload) {
      trace.push(`fact-world:${type}`, `fact-events:${type}`);
      facts.push({ type, payload: payload() });
      if (failure === "first_fact") throw Error("test_fact_record_failed");
    },
  };
  const prepare = new AnimalDeathWavePreparation(true, 2, nightEffects, () => true, ports);
  return { trace, facts, prepare };
}

test("an unowned animal wave preserves the original list and performs no unit or port read", () => {
  const ids = [9],
    trace: string[] = [],
    ports = new Proxy({} as Ports, {
      get() {
        trace.push("port");
        throw Error("no_port_expected");
      },
    });
  const effects = {
    get animalUnit(): object {
      trace.push("unit");
      throw Error("no_unit_expected");
    },
  };
  const prepare = new AnimalDeathWavePreparation(false, 2, effects, () => true, ports);
  expect(trace).toEqual([]);
  expect(prepare.prepare(ids, {}, Phase.Night)).toBe(ids);
  expect(trace).toEqual([]);
});

test("cat facts precede source deletion and expiry restores only the retained valid causes in their original order", () => {
  const f = fixture(),
    sources: DeathSources = {
      9: [DeathCause.WolfKill, DeathCause.Exile, DeathCause.PufferRetaliation],
    };
  expect(f.trace).toEqual([]);
  expect(f.prepare.prepare([9], sources, Phase.Night)).toEqual([9]);
  expect(sources).toEqual({
    9: [DeathCause.Exile, DeathCause.PufferRetaliation, DeathCause.WhiteCatExpiry],
  });
  expect(f.facts).toEqual([
    {
      type: "animal_wave_prepared",
      payload: {
        policy: "awa_animal_dream_v1",
        day: 2,
        phase: "night",
        proposedIds: [9],
        blockedCatId: 9,
      },
    },
    { type: "animal_cat_revealed", payload: { policy: "awa_animal_dream_v1", day: 2, actorId: 9 } },
    {
      type: "animal_cat_expiry_prepared",
      payload: { policy: "awa_animal_dream_v1", day: 2, actorId: 9, unit: 3, unitKind: "night" },
    },
  ]);
  expect(f.trace).toEqual([
    "filter-world",
    "unit",
    "fact-world:animal_wave_prepared",
    "fact-events:animal_wave_prepared",
    "fact-world:animal_cat_revealed",
    "fact-events:animal_cat_revealed",
    "unit",
    "authority",
    "expiry-world",
    "unit",
    "authority",
    "fact-world:animal_cat_expiry_prepared",
    "fact-events:animal_cat_expiry_prepared",
    "number",
    "kind",
  ]);
});

test("an expiry failure keeps previously published cat facts and the source deletion", () => {
  const f = fixture("expiry"),
    sources: DeathSources = { 9: [DeathCause.WolfKill, DeathCause.Exile] };
  expect(() => f.prepare.prepare([9], sources, Phase.Night)).toThrow("test_expiry_failed");
  expect(f.facts.map((row) => row.type)).toEqual(["animal_wave_prepared", "animal_cat_revealed"]);
  expect(sources).toEqual({});
  expect(f.trace.slice(-3)).toEqual(["authority", "expiry-world", "unit"]);
});

test("a first-fact record failure keeps that fact but cannot delete sources or begin expiry", () => {
  const f = fixture("first_fact"),
    original = [DeathCause.WolfKill],
    sources: DeathSources = { 9: original };
  expect(() => f.prepare.prepare([9], sources, Phase.Night)).toThrow("test_fact_record_failed");
  expect(f.facts.map((row) => row.type)).toEqual(["animal_wave_prepared"]);
  expect(sources[9]).toBe(original);
  expect(f.trace).toEqual([
    "filter-world",
    "unit",
    "fact-world:animal_wave_prepared",
    "fact-events:animal_wave_prepared",
  ]);
});
