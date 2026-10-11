import { expect, test } from "bun:test";
import {
  planSecretBodyBlock,
  type SecretBodyCause,
  type SecretBodySources,
} from "../../../src/game/mechanisms/roles/noble_secret_body/damage";
const cases: Array<{
  name: string;
  target: number | null;
  before: SecretBodySources;
  after: SecretBodySources;
  blocked: { targetId: number; cause: SecretBodyCause } | null;
}> = [
  {
    name: "chosen刀毒双中不转护本人到期",
    target: 6,
    before: { 6: ["poison", "wolf_kill"], 5: ["servant_expiry"] },
    after: { 6: ["poison"], 5: ["servant_expiry"] },
    blocked: { targetId: 6, cause: "wolf_kill" },
  },
  {
    name: "所选者刀已救活转护本人到期",
    target: 6,
    before: { 5: ["servant_expiry"] },
    after: {},
    blocked: { targetId: 5, cause: "servant_expiry" },
  },
  {
    name: "所选无伤本人毒到期只挡毒",
    target: 6,
    before: { 7: ["wolf_kill"], 5: ["servant_expiry", "poison"] },
    after: { 7: ["wolf_kill"], 5: ["servant_expiry"] },
    blocked: { targetId: 5, cause: "poison" },
  },
  { name: "猎魔原生毒免过滤后不消费", target: 4, before: {}, after: {}, blocked: null },
  {
    name: "猎错好人反噬可挡",
    target: 4,
    before: { 4: ["demon_hunt_backlash"] },
    after: {},
    blocked: { targetId: 4, cause: "demon_hunt_backlash" },
  },
  {
    name: "合法猎狼命中可挡",
    target: 1,
    before: { 1: ["demon_hunt"] },
    after: {},
    blocked: { targetId: 1, cause: "demon_hunt" },
  },
  {
    name: "明确空过只自护",
    target: null,
    before: { 6: ["wolf_kill"], 5: ["poison"] },
    after: { 6: ["wolf_kill"] },
    blocked: { targetId: 5, cause: "poison" },
  },
  {
    name: "明确自选按同一单来源",
    target: 5,
    before: { 5: ["servant_expiry", "demon_hunt_backlash", "poison", "wolf_kill", "demon_hunt"] },
    after: { 5: ["servant_expiry", "demon_hunt_backlash", "poison", "demon_hunt"] },
    blocked: { targetId: 5, cause: "wolf_kill" },
  },
  {
    name: "目标只有到期就挡到期",
    target: 6,
    before: { 6: ["servant_expiry"], 5: ["wolf_kill"] },
    after: { 5: ["wolf_kill"] },
    blocked: { targetId: 6, cause: "servant_expiry" },
  },
  { name: "无人受伤不消费", target: 6, before: {}, after: {}, blocked: null },
];
for (const c of cases)
  test(c.name, () => {
    const input = structuredClone(c.before),
      saved = structuredClone(input),
      result = planSecretBodyBlock(5, c.target, input);
    expect(result).toEqual({ blocked: c.blocked, sources: c.after });
    expect(input).toEqual(saved);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.sources)).toBe(true);
    for (const list of Object.values(result.sources)) expect(Object.isFrozen(list)).toBe(true);
    if (result.blocked) expect(Object.isFrozen(result.blocked)).toBe(true);
  });
test("invalid finite sources and IDs do not authorize any block", () => {
  for (const sources of [
    { "06": ["wolf_kill"] },
    { 6: ["wolf_kill", "wolf_kill"] },
    { 6: ["hunter_shot"] },
    { 6: null },
  ])
    expect(() => planSecretBodyBlock(5, 6, sources as unknown as SecretBodySources)).toThrow(
      "secret_body_sources_invalid",
    );
  expect(() => planSecretBodyBlock(0, 6, {})).toThrow("secret_body_target_invalid");
});
test("literal five-level source priority is independent of input ordering", () => {
  const priority = [
    "wolf_kill",
    "poison",
    "demon_hunt",
    "demon_hunt_backlash",
    "servant_expiry",
  ] as const;
  for (let i = 0; i < priority.length; i++) {
    const before = [...priority.slice(i)].reverse();
    const result = planSecretBodyBlock(5, 6, { 6: before, 5: ["servant_expiry"] });
    expect(result.blocked).toEqual({ targetId: 6, cause: priority[i]! });
    expect(result.sources[6] ?? []).toEqual(before.filter((c) => c !== priority[i]));
    expect(result.sources[5]).toEqual(["servant_expiry"]);
  }
});
test("original iterator, getter and sparse-array counterexamples reject without executing input code", () => {
  let iterations = 0,
    reads = 0;
  const iterator = ["wolf_kill", "poison"];
  Object.defineProperty(iterator, Symbol.iterator, {
    value: function* () {
      iterations++;
      yield "wolf_kill";
      yield "hunter_shot";
    },
  });
  const getter: unknown[] = [];
  Object.defineProperty(getter, "0", {
    enumerable: true,
    get() {
      reads++;
      return "poison";
    },
  });
  getter.length = 1;
  for (const list of [iterator, getter, new Array(1)])
    expect(() => planSecretBodyBlock(5, 6, { 6: list } as SecretBodySources)).toThrow(
      "secret_body_sources_invalid",
    );
  expect(iterations).toBe(0);
  expect(reads).toBe(0);
});
