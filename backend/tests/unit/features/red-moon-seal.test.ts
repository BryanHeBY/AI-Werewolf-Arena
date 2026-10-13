/**
 * Unit tests: Red Moon seals use in-memory native stage frames and explicit next nights;
 * literal request counts, stock preservation and eligibility assertions check
 * sealed/unsealed transitions. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 * The controlled context binds its query at the original World read position.
 */
import { bindNativeNightFailurePolicy } from "../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../src/game/mechanisms/roles/night-ability-actors";
import { expect, test } from "bun:test";
import { COMPONENT, type AliveComponent, type RoleComponent } from "../../../src/core";
import { redMoonCandidateWorld } from "../../support/features/red-moon/builders/candidate-world";
import {
  beginDemonHunterNight,
  closeDemonHunterNight,
  commitDemonRedMoonTransition,
  demonRedMoonNightSealed,
  demonHunterNeedsTurn,
  demonWitchRequiredThisNight,
  demonNativeNightActor,
  openDemonHunterTurn,
  openDemonWitchTurnFrame,
  openDemonNativeNightFrame,
  freezeDemonHunt,
  demonHunterCheckpointPlayers,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
import { DEMON_HUNTER_NIGHT_STAGE } from "../../../src/game/mechanisms/roles/demon_hunter/night_stages";
import { SEER_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/seer/night_stages";
import { WITCH_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/witch/night_stages";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";
function sealedWorld() {
  const fixture = redMoonCandidateWorld();
  beginDemonHunterNight(fixture.world, 1, () => true);
  freezeDemonHunt(fixture.world);
  closeDemonHunterNight(fixture.world);
  expect(commitDemonRedMoonTransition(fixture.world, 4, "blast", 1)).toBe(true);
  fixture.world.getComponent<AliveComponent>(4, COMPONENT.Alive)!.alive = false;
  beginDemonHunterNight(fixture.world, 2, () => true);
  return fixture;
}
test("Red Moon sealed night runs all good native stages without requests or inventory changes", async () => {
  const { world, catalog } = sealedWorld();
  const before = [9, 10, 11, 12].map((id) =>
    JSON.stringify(world.getComponent<RoleComponent>(id, COMPONENT.Role)!.privateState),
  );
  let requests = 0;
  const unexpected = (): never => {
    throw new Error("sealed_stage_requested_action");
  };
  const ctx: NightStageContext = {
    world,
    get nightActors() {
      return bindNightAbilityActorQuery(this.world);
    },
    get nativeNightFailure() {
      return bindNativeNightFailurePolicy(() => this.world);
    },
    get nativeNightTargets() {
      return bindNativeNightTargetPolicy(() => this);
    },
    get nativeNightEffects() {
      return bindNativeNightEffects(() => this);
    },
    roleCatalog: catalog,
    toolGateway: new ToolGateway(),
    events: [],
    isCurrent: () => true,
    previousExile: null,
    currentDay: () => 2,
    actionProvider: {
      async getAction() {
        requests++;
        return unexpected();
      },
    },
    makeRequest: unexpected,
    getAliveByRole: unexpected,
    ensureMarks: unexpected,
    pickMajorityTarget: unexpected,
    shuffleWolves: unexpected,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: 5,
      seerChecks: [],
      dreamLinks: [],
    },
  };
  for (const stage of [...WITCH_NIGHT_STAGES, ...SEER_NIGHT_STAGES, DEMON_HUNTER_NIGHT_STAGE])
    await stage.execute(ctx);
  expect(requests).toBe(0);
  expect(ctx.events).toEqual([]);
  expect(ctx.state.seerChecks).toEqual([]);
  expect(ctx.state.poisonClaims).toBeUndefined();
  expect(
    [9, 10, 11, 12].map((id) =>
      JSON.stringify(world.getComponent<RoleComponent>(id, COMPONENT.Role)!.privateState),
    ),
  ).toEqual(before);
  expect(freezeDemonHunt(world)).toEqual({ choice: null, damage: null, cancelled: null });
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
test("Sealed native frames reject direct opening and restore eligibility next night", () => {
  const { world } = sealedWorld();
  expect(demonHunterNeedsTurn(world, 2)).toBe(false);
  expect(demonWitchRequiredThisNight(world)).toBe(false);
  expect(demonNativeNightActor(world, "seer_check")).toBeNull();
  expect(openDemonWitchTurnFrame(world)).toBeNull();
  expect(() => openDemonHunterTurn(world)).toThrow("demon_hunter_turn_unavailable");
  const seer = world.getComponent<RoleComponent>(9, COMPONENT.Role)!;
  const ability = (seer.privateState.abilities as Record<string, object>)["native:seer_check"]!;
  expect(openDemonNativeNightFrame(world, 9, ability, "seer_check", 2)).toBeNull();
  freezeDemonHunt(world);
  closeDemonHunterNight(world);
  beginDemonHunterNight(world, 3, () => true);
  expect(demonRedMoonNightSealed(world, 3)).toBe(false);
  expect(demonHunterNeedsTurn(world, 3)).toBe(true);
  expect(demonWitchRequiredThisNight(world)).toBe(true);
  expect(demonNativeNightActor(world, "seer_check")?.actorId).toBe(9);
  expect(openDemonWitchTurnFrame(world)).not.toBeNull();
  expect(openDemonNativeNightFrame(world, 9, ability, "seer_check", 3)).not.toBeNull();
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
test("Without a Red Moon blast the living good roles retain native eligibility", () => {
  const { world } = redMoonCandidateWorld();
  beginDemonHunterNight(world, 2, () => true);
  expect(demonRedMoonNightSealed(world, 2)).toBe(false);
  expect(demonHunterNeedsTurn(world, 2)).toBe(true);
  expect(demonWitchRequiredThisNight(world)).toBe(true);
  expect(demonNativeNightActor(world, "seer_check")?.actorId).toBe(9);
});

for (const mutation of ["replace", "in_place"] as const)
  test(`Red Moon seal retains original identity binding after ${mutation}`, () => {
    const { world } = redMoonCandidateWorld();
    expect(demonRedMoonNightSealed(world, 2)).toBe(false);
    const red = world.getComponent<RoleComponent>(4, COMPONENT.Role)!;
    const wolf = world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
    if (mutation === "replace") world.addComponent(4, COMPONENT.Role, { ...red, role: wolf.role });
    else red.role = wolf.role;
    expect(() => demonRedMoonNightSealed(world, 2)).toThrow("red_moon_original_state_revoked");
  });
