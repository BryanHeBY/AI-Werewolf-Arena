/**
 * Unit tests for noble-secret-body; Isolated noble-secret-body damage-snapshot contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { planSecretBodyBlock } from "../../../../src/game/mechanisms/roles/noble_secret_body/damage";
const invalid = (source: unknown) =>
  expect(() => planSecretBodyBlock(5, 6, source as any)).toThrow("secret_body_sources_invalid");
test("whole source proxies reject before any trap", () => {
  let reads = 0;
  const p = new Proxy(
    { 6: ["wolf_kill"] },
    {
      get() {
        reads++;
        throw Error("trap");
      },
      ownKeys() {
        reads++;
        throw Error("trap");
      },
      getOwnPropertyDescriptor() {
        reads++;
        throw Error("trap");
      },
      getPrototypeOf() {
        reads++;
        throw Error("trap");
      },
    },
  );
  invalid(p);
  expect(reads).toBe(0);
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  invalid(revoked.proxy);
});
test("own source getter is never called", () => {
  let reads = 0;
  const source = {};
  Object.defineProperty(source, "6", {
    enumerable: true,
    get() {
      reads++;
      return ["wolf_kill"];
    },
  });
  invalid(source);
  expect(reads).toBe(0);
});
test("prototype proxy is rejected without consulting proxy traps", () => {
  let reads = 0;
  const proto = new Proxy(
    {},
    {
      get() {
        reads++;
        throw Error("trap");
      },
      ownKeys() {
        reads++;
        throw Error("trap");
      },
      getPrototypeOf() {
        reads++;
        throw Error("trap");
      },
    },
  );
  const source = Object.create(proto);
  source[6] = ["wolf_kill"];
  invalid(source);
  expect(reads).toBe(0);
});
test("nested array proxies reject before any trap, including revoked proxies", () => {
  let reads = 0;
  const a = new Proxy(["wolf_kill"], {
    get() {
      reads++;
      throw Error("trap");
    },
    ownKeys() {
      reads++;
      throw Error("trap");
    },
    getOwnPropertyDescriptor() {
      reads++;
      throw Error("trap");
    },
    getPrototypeOf() {
      reads++;
      throw Error("trap");
    },
  });
  invalid({ 6: a });
  expect(reads).toBe(0);
  const b = Proxy.revocable([], {});
  b.revoke();
  invalid({ 6: b.proxy });
});
test("causes must be primitive canonical strings without coercion", () => {
  let reads = 0;
  const cause = new Proxy(
    {},
    {
      get() {
        reads++;
        throw Error("trap");
      },
    },
  );
  invalid({ 6: [cause] });
  invalid({ 6: [new String("wolf_kill")] });
  for (const cause of [
    "WolfKillMark",
    "wolf_kill ",
    "Poison",
    "night",
    "radiant_backlash",
    "dream",
    "",
  ])
    invalid({ 6: [cause] });
  expect(reads).toBe(0);
});
test("numeric player key canonicalization and hidden symbols do not authorize effects", () => {
  for (const key of [
    "06",
    "6.0",
    "6e0",
    "+6",
    " 6",
    "6 ",
    "-0",
    "NaN",
    "Infinity",
    "9007199254740991",
  ])
    invalid({ [key]: ["wolf_kill"] });
  const x = { 6: ["wolf_kill"] };
  Object.defineProperty(x, Symbol("private"), { value: ["poison"] });
  invalid(x);
});
test("extra array serialization hook is not consulted", () => {
  let reads = 0;
  const a: any = ["wolf_kill"];
  Object.defineProperty(a, "toJSON", {
    get() {
      reads++;
      return () => ["poison"];
    },
  });
  invalid({ 6: a });
  expect(reads).toBe(0);
});
test("shared source arrays become independent immutable outputs", () => {
  const same: any = ["poison", "wolf_kill"];
  const input: any = { 5: same, 6: same, 7: [] };
  const out = planSecretBodyBlock(5, 6, input);
  expect(out).toEqual({
    blocked: { targetId: 6, cause: "wolf_kill" },
    sources: { 5: ["poison", "wolf_kill"], 6: ["poison"] },
  });
  same[0] = "demon_hunt";
  input[5] = [];
  delete input[6];
  expect(out.sources).toEqual({ 5: ["poison", "wolf_kill"], 6: ["poison"] });
  expect(out.sources[5]).not.toBe(out.sources[6]);
  expect(Object.isFrozen(out.sources[5])).toBe(true);
  expect(Object.isFrozen(out.sources[6])).toBe(true);
});
test("null prototype frozen sources retain only the literal one-source plan", () => {
  const src = Object.create(null);
  src[5] = Object.freeze(["servant_expiry"]);
  src[6] = Object.freeze(["demon_hunt_backlash", "demon_hunt"]);
  Object.freeze(src);
  expect(planSecretBodyBlock(5, 6, src)).toEqual({
    blocked: { targetId: 6, cause: "demon_hunt" },
    sources: { 5: ["servant_expiry"], 6: ["demon_hunt_backlash"] },
  });
});
