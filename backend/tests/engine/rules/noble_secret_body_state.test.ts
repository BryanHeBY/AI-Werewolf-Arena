import { expect, test } from "bun:test";
import {
  createSecretBodyState,
  chooseBodyTarget,
  spendBodyForNight,
  revealBodyByExile,
  readSecretBodyState,
  createNobleState,
  chooseServant,
  endServant,
  readNobleState,
} from "../../../src/game/mechanisms/roles/noble_secret_body/state";
const living = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
for (const policy of ["awa_nonconsecutive_nights_v1", "awa_repeat_v1"] as const) {
  test(`body literal adjacent/gap/null/self policy ${policy}`, () => {
    const initial = createSecretBodyState(policy),
      n1 = chooseBodyTarget(initial, 1, 6, living);
    expect(initial.lastChoice).toBeNull();
    expect(n1.body).toEqual({ kind: "intact" });
    if (policy === "awa_nonconsecutive_nights_v1")
      expect(() => chooseBodyTarget(n1, 2, 6, living)).toThrow("secret_body_target");
    else expect(chooseBodyTarget(n1, 2, 6, living).lastChoice).toEqual({ day: 2, targetId: 6 });
    expect(chooseBodyTarget(n1, 3, 6, living).lastChoice).toEqual({ day: 3, targetId: 6 });
    const pass = chooseBodyTarget(n1, 2, null, living);
    expect(chooseBodyTarget(pass, 3, 6, living).lastChoice).toEqual({ day: 3, targetId: 6 });
    expect(chooseBodyTarget(n1, 2, 5, living).lastChoice).toEqual({ day: 2, targetId: 5 });
    expect(() => chooseBodyTarget(n1, 1, null, living)).toThrow("secret_body_unavailable");
  });
  test(`body actual spend preserves choice history and rejects second consumption ${policy}`, () => {
    const n = chooseBodyTarget(createSecretBodyState(policy), 2, 6, living),
      spent = spendBodyForNight(n, 2, 5, { targetId: 5, cause: "poison" });
    expect(spent.lastChoice).toEqual({ day: 2, targetId: 6 });
    expect(n.body).toEqual({ kind: "intact" });
    expect(spent.body).toEqual({ kind: "night_spent", day: 2, targetId: 5, cause: "poison" });
    expect(readSecretBodyState(spent)).toEqual(spent);
    expect(() => spendBodyForNight(spent, 2, 5, { targetId: 6, cause: "wolf_kill" })).toThrow(
      "secret_body_unavailable",
    );
    expect(() => chooseBodyTarget(spent, 3, null, living)).toThrow("secret_body_unavailable");
    expect(() => revealBodyByExile(spent, 2)).toThrow("secret_body_unavailable");
    expect(() => spendBodyForNight(n, 2, 5, { targetId: 7, cause: "poison" })).toThrow(
      "secret_body_block_invalid",
    );
  });
}
for (const policy of ["standard", "no_blast_no_self_knife"] as const) {
  test(`servant literal N2 N3 occupied expiry N4 new ${policy}`, () => {
    const initial = createNobleState(policy),
      n2 = chooseServant(initial, 2, 6, 1, living);
    expect(initial.contracts).toEqual([]);
    expect(readNobleState(n2)).toEqual(n2);
    expect(() => chooseServant(n2, 3, 7, 1, living)).toThrow("night_noble_unavailable");
    const ended = endServant(n2, "servant:night:2", 3, "expired");
    expect(readNobleState(ended)).toEqual(ended);
    expect(
      chooseServant(ended, 4, 7, 1, living).contracts.map((c) => [
        c.createdNight,
        c.targetId,
        c.status.kind,
      ]),
    ).toEqual([
      [2, 6, "expired"],
      [4, 7, "pending"],
    ]);
    expect(() => endServant(ended, "servant:night:2", 3, "expired")).toThrow(
      "night_noble_contract_unavailable",
    );
  });
  for (const terminal of ["cleared", "target_dead"] as const)
    test(`same night terminal frees next night ${policy}/${terminal}`, () => {
      const n2 = chooseServant(createNobleState(policy), 2, 10, 1, living),
        ended = endServant(n2, "servant:night:2", 2, terminal);
      expect(chooseServant(ended, 3, 7, 1, living).contracts[1]).toMatchObject({
        createdNight: 3,
        expiresNight: 4,
        targetId: 7,
      });
      expect(() => chooseServant(ended, 2, 7, 1, living)).toThrow("night_noble_unavailable");
    });
}
test("body exile is a single spent resource and not another night choice", () => {
  const state = revealBodyByExile(chooseBodyTarget(createSecretBodyState(), 1, 6, living), 1);
  expect(state.body).toEqual({ kind: "exile_revealed", day: 1 });
  expect(readSecretBodyState(state)).toEqual(state);
  expect(() => revealBodyByExile(state, 2)).toThrow("secret_body_unavailable");
});
test("servant first night, self/dead, early expiry and hostile accessors are rejected", () => {
  const initial = createNobleState();
  expect(() => chooseServant(initial, 1, null, 1, living)).toThrow("night_noble_unavailable");
  for (const target of [1, 99])
    expect(() => chooseServant(initial, 2, target, 1, living)).toThrow("night_noble_target");
  const n2 = chooseServant(initial, 2, 6, 1, living);
  expect(() => endServant(n2, "servant:night:2", 2, "expired")).toThrow(
    "night_noble_contract_unavailable",
  );
  let reads = 0;
  const bad = Object.defineProperty({ ...n2 }, "contracts", {
    enumerable: true,
    get() {
      reads++;
      return [];
    },
  });
  expect(readNobleState(bad)).toBeUndefined();
  expect(reads).toBe(0);
  const body = Object.defineProperty(createSecretBodyState(), "body", {
    enumerable: true,
    get() {
      reads++;
      return { kind: "intact" };
    },
  });
  expect(readSecretBodyState(body)).toBeUndefined();
  expect(reads).toBe(0);
});
