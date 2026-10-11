import { expect, test } from "bun:test";
import {
  createNobleState,
  chooseServant,
  endServant,
  readNobleState,
} from "../../../src/game/mechanisms/roles/noble_secret_body/state";
const living = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
for (const terminal of ["expired", "cleared", "target_dead"] as const) {
  const ended = () =>
    endServant(chooseServant(createNobleState(), 2, 6, 1, living), "servant:night:2", 3, terminal);
  for (const target of [7, null])
    test(`N3 ${terminal} rejects same-night ${target === null ? "pass" : "new servant"}`, () => {
      expect(() => chooseServant(ended(), 3, target, 1, living)).toThrow("night_noble_unavailable");
    });
  test(`reader rejects invented N3 pass after ${terminal}`, () => {
    expect(readNobleState({ ...ended(), lastChoice: { day: 3, targetId: null } })).toBeUndefined();
  });
  test(`N4 stays eligible after N3 ${terminal}`, () => {
    const next = chooseServant(ended(), 4, 7, 1, living);
    expect(readNobleState(next)).toEqual(next);
  });
}
