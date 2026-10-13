/**
 * Unit tests for ordinary Guard payload write ownership.
 * Inputs are literal original/captured state references and adversarial target
 * getters; exact access order, stale alias identity and original errors are the
 * oracle. Ability use, marks, lease rechecks and Demon sealed commits are separate.
 * Reader compiler examples cannot overwrite native lastTarget directly.
 */
import type { GuardState } from "@ai-werewolf-arena/game-contract";

import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../../src/core/domain/components/role";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import {
  getGuardState,
  recordGuardTarget,
  recordRecipientGuardTarget,
} from "../../../../src/game/mechanisms/roles/guard/ports";
import { setGuardState } from "../../../../src/game/mechanisms/roles/guard/state";
function readerPermission(state: GuardState) {
  // @ts-expect-error The last-target field belongs to the Guard payload owner.
  state.lastTarget = 3;
}
void readerPermission;
function fixture() {
  const role = createRoleComponent(Role.Guard, Camp.Good, "en"),
    state = setGuardState(role, { lastTarget: null }),
    ability = findNightAbility(role, "guard")!;
  return { role, state, ability };
}
test("recipient target evaluation cannot redirect the already selected state reference", () => {
  const f = fixture(),
    replacement: GuardState = { lastTarget: 8 },
    accesses: string[] = [];
  let selected = f.state;
  Object.defineProperty(f.ability, "state", {
    get() {
      accesses.push("state");
      return selected;
    },
    set(value) {
      selected = value;
    },
  });
  const target = {
    get id() {
      accesses.push("target");
      (f.ability as { state: GuardState }).state = replacement;
      return 4;
    },
  };
  recordRecipientGuardTarget(f.ability, target);
  expect(accesses).toEqual(["state", "target"]);
  expect(f.state.lastTarget).toBe(4);
  expect(replacement.lastTarget).toBe(8);
  expect(f.ability.uses).toBe(0);
  expect(f.ability.lastUsedDay).toBe(null);
});
test("a target getter failure preserves original state and resource metadata", () => {
  const f = fixture(),
    failure = new Error("guard_target_getter_failed");
  let caught: unknown;
  try {
    recordRecipientGuardTarget(f.ability, {
      get id(): number {
        throw failure;
      },
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(getGuardState(f.role)).toBe(f.state);
  expect(f.state.lastTarget).toBe(null);
  expect(f.ability.uses).toBe(0);
});
test("ordinary state setter rejection propagates without spending an ability or replacing its slot", () => {
  const f = fixture(),
    failure = new Error("guard_state_setter_failed");
  Object.defineProperty(f.state, "lastTarget", {
    get: () => null,
    set() {
      throw failure;
    },
  });
  let caught: unknown;
  try {
    recordGuardTarget(f.state, 6);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(getGuardState(f.role)).toBe(f.state);
  expect(f.state.lastTarget).toBe(null);
  expect(f.ability.uses).toBe(0);
});
