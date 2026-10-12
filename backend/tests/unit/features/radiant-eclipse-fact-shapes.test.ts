/**
 * Unit tests: Radiant Eclipse fact readers use literal empty/pass/villager/borrowed
 * records; exact target/ability/close-field rejection expectations check legal data
 * shapes. Inputs and expected outcomes remain the original literal or immutable-fixture
 * oracle; these module assertions invoke no model or complete-game driver.
 */
import { expect, test } from "bun:test";
import { readRadiantEclipseFact } from "@ai-werewolf-arena/game-text";
const close = (body: object) => readRadiantEclipseFact("eclipse_lease_closed", body);
for (const status of ["committed", "aborted"]) {
  test(`${status}: literal legal day1 empty, pass, villager and actual borrowed close shapes`, () => {
    for (const p of [
      { actorId: 1, day: 1, targetId: null, abilityId: null, status },
      { actorId: 1, day: 2, targetId: null, abilityId: null, status },
      { actorId: 1, day: 2, targetId: 6, abilityId: null, status },
      { actorId: 1, day: 2, targetId: 3, abilityId: "copy:eclipse:night:2", status },
    ])
      expect(close(p)).not.toBeNull();
  });
  test(`${status}: no target cannot have a borrowed skill identity`, () =>
    expect(
      close({ actorId: 1, day: 2, targetId: null, abilityId: "copy:eclipse:night:2", status }),
    ).toBeNull());
  test(`${status}: first night cannot close a non-existent swallowed target`, () =>
    expect(
      close({ actorId: 1, day: 1, targetId: 3, abilityId: "copy:eclipse:night:1", status }),
    ).toBeNull());
  test(`${status}: a valid close cannot claim that the Maid swallowed herself`, () =>
    expect(
      close({ actorId: 1, day: 2, targetId: 1, abilityId: "copy:eclipse:night:2", status }),
    ).toBeNull());
}
