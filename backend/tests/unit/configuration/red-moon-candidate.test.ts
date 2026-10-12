/**
 * Unit tests: Red Moon eligibility uses the declared last-wolf policies and exact finite
 * roster; literal installed-profile/state equality checks policy-specific setup. Inputs
 * and expected outcomes remain the original literal or immutable-fixture oracle; these
 * module assertions invoke no model or complete-game driver.
 */
import { expect, test } from "bun:test";
import { isDemonHunterPreset, isRedMoonPreset } from "../../../src/rulesets";
import { COMPONENT, type RoleComponent } from "../../../src/core";
import { redMoonCandidateWorld } from "../../support/features/red-moon/builders/candidate-world";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { getRedMoonState } from "../../../src/game/mechanisms/roles/red_moon_apostle/state";
import {
  demonHunterActorId,
  demonHunterCheckpointPlayers,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
for (const policy of ["ends_game", "forbidden"] as const)
  test(policy + ": finite roster installs with matching runtime profile", () => {
    const { world, config, ids } = redMoonCandidateWorld(policy);
    expect(ids).toHaveLength(12);
    expect(isRedMoonPreset(config)).toBe(true);
    expect(isDemonHunterPreset(config)).toBe(true);
    expect(demonHunterActorId(world)).toBe(11);
    expect(
      getRedMoonState(world.getComponent<RoleComponent>(4, COMPONENT.Role))?.lastWolfBlastPolicy,
    ).toBe(policy);
    expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
    expect(
      getDefaultRoleCatalog()
        .all()
        .some((p) => String(p.role) === "red_moon_apostle"),
    ).toBe(true);
  });
