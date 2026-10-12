/**
 * Unit tests for animal-dream; Isolated animal-dream roster contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import type { CampComponent } from "../../../../src/core/domain/components/camp";
import type { RoleComponent } from "../../../../src/core/domain/components/role";
import type { IdentityComponent } from "../../../../src/core/domain/entities/player";
import { animalRosterFixture, animalInternalConfig } from "../../../engine/animal_dream_fixture";
import {
  installAnimalRoster,
  animalRosterCurrent,
  animalOriginalPlayer,
  animalOriginalRolePlayer,
  animalRosterPolicies,
} from "../../../../src/game/mechanisms/roles/animal_dream/roster";
test("complete original Animal roster holds policy values without public activation", () => {
  const f = animalRosterFixture();
  expect(animalRosterCurrent(f.world)).toBe(true);
  expect(animalOriginalRolePlayer(f.world, "white_cat")?.scope.id).toBe(9);
  expect(animalOriginalRolePlayer(f.world, "fox_cub")?.scope.id).toBe(10);
  expect(animalOriginalRolePlayer(f.world, "pufferfish")?.scope.id).toBe(12);
  expect(animalOriginalRolePlayer(f.world, "wolf")).toBeNull();
  f.config.whiteCat.skippedVotePolicy = "awa_expire_on_skipped_day_v1";
  expect(animalRosterPolicies(f.world)).toEqual({
    skippedVotePolicy: "awa_wait_for_actual_exile_v1",
    ballotPolicy: "awa_final_ballot_v1",
  });
  expect(() => installAnimalRoster(f.world, animalInternalConfig())).toThrow(
    "animal_roster_already_installed",
  );
});
test("real first death retains original relation identity; revival does not", () => {
  const f = animalRosterFixture();
  f.life(12).alive = false;
  expect(animalRosterCurrent(f.world)).toBe(true);
  expect(animalOriginalPlayer(f.world, 12)).toBeNull();
  expect(animalOriginalPlayer(f.world, 12, false)?.scope.life).toBe(f.life(12));
  f.life(12).alive = true;
  expect(animalRosterCurrent(f.world)).toBe(false);
});
test("observed Camp drift is terminal after restoration", () => {
  const f = animalRosterFixture(),
    camp = f.world.getComponent<CampComponent>(10, COMPONENT.Camp)!;
  camp.camp = Camp.Wolf;
  expect(animalRosterCurrent(f.world)).toBe(false);
  camp.camp = Camp.Good;
  expect(animalRosterCurrent(f.world)).toBe(false);
  expect(animalOriginalRolePlayer(f.world, "fox_cub")).toBeNull();
});
test("replacement body cannot revive roster ownership", () => {
  const f = animalRosterFixture(),
    original = f.life(9);
  f.world.addComponent(9, COMPONENT.Alive, createAliveComponent());
  expect(animalRosterCurrent(f.world)).toBe(false);
  f.world.addComponent(9, COMPONENT.Alive, original);
  expect(animalRosterCurrent(f.world)).toBe(false);
});
test("Identity metadata mutation revokes, ordinary private JSON state updates do not", () => {
  const f = animalRosterFixture();
  f.role(11).privateState.bear = { history: [{ day: 1, roared: false }] };
  expect(animalRosterCurrent(f.world)).toBe(true);
  f.world.getComponent<IdentityComponent>(11, COMPONENT.Identity)!.name = "changed";
  expect(animalRosterCurrent(f.world)).toBe(false);
});
const invalid: Record<string, (w: ReturnType<typeof animalRosterFixture>["world"]) => void> = {
  "unsupported actual role": (w) => {
    w.getComponent<RoleComponent>(10, COMPONENT.Role)!.role = Role.Seer;
  },
  "wrong actual Fox camp": (w) => {
    w.getComponent<RoleComponent>(10, COMPONENT.Role)!.camp = Camp.Wolf;
    w.getComponent<CampComponent>(10, COMPONENT.Camp)!.camp = Camp.Wolf;
  },
  "shared life": (w) => {
    w.addComponent(6, COMPONENT.Alive, w.getComponent(5, COMPONENT.Alive));
  },
  "Role and Camp alias": (w) => {
    w.addComponent(10, COMPONENT.Camp, w.getComponent(10, COMPONENT.Role));
  },
  "shared private container": (w) => {
    w.getComponent<RoleComponent>(6, COMPONENT.Role)!.privateState = w.getComponent<RoleComponent>(
      5,
      COMPONENT.Role,
    )!.privateState;
  },
  "duplicate seat": (w) => {
    w.getComponent<IdentityComponent>(6, COMPONENT.Identity)!.seat = 5;
  },
  "duplicate session": (w) => {
    w.getComponent<IdentityComponent>(6, COMPONENT.Identity)!.sessionId = "player_5";
  },
  "wrong victory": (w) => {
    w.addComponent(1, COMPONENT.Victory, {
      affiliations: [{ kind: "faction", faction: Camp.Good }],
    });
  },
};
for (const [label, mutate] of Object.entries(invalid))
  test(`reject ${label} before roster installation`, () =>
    expect(() => animalRosterFixture(mutate)).toThrow("animal_initial_roster_invalid"));
test("invalid private accessors are rejected without executing them", () => {
  let calls = 0;
  expect(() =>
    animalRosterFixture((w) => {
      Object.defineProperty(w.getComponent<RoleComponent>(9, COMPONENT.Role)!, "privateState", {
        enumerable: true,
        get() {
          calls++;
          return {};
        },
      });
    }),
  ).toThrow();
  expect(calls).toBe(0);
});
test("late private accessors revoke without invoking or replacing original inventory", () => {
  const f = animalRosterFixture();
  let calls = 0;
  Object.defineProperty(f.role(10).privateState, "foxCub", {
    enumerable: true,
    get() {
      calls++;
      return {};
    },
  });
  expect(animalRosterCurrent(f.world)).toBe(false);
  expect(calls).toBe(0);
});
