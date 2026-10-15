/**
 * 单元测试：验证赤月封印在封印／未封印夜之间的转换。输入为原内存阶段 frame 与明确下一夜；请求次数、库存保留和资格为字面预期，查询仍在原 World 读取点绑定。
 */
import { bindNativeNightFailurePolicy } from "../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../src/features/night-abilities/night-ability-actors";
import { expect, test } from "bun:test";
import { COMPONENT, type AliveComponent, type RoleComponent } from "../../../src/domain";
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
} from "../../../src/features/demon-hunter/authority";
import { DEMON_HUNTER_NIGHT_STAGE } from "../../../src/features/demon-hunter/night-stages";
import { SEER_NIGHT_STAGES } from "../../../src/features/seer/night-stages";
import { WITCH_NIGHT_STAGES } from "../../../src/features/witch/night-stages";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import type { NightStageContext } from "../../../src/engine/night/contracts";
function sealedWorld() {
  const fixture = redMoonCandidateWorld();
  beginDemonHunterNight(fixture.world, 1, () => true);
  freezeDemonHunt(fixture.world);
  closeDemonHunterNight(fixture.world);
  expect(commitDemonRedMoonTransition(fixture.world, 4, "blast", 1)).toBe(true);
  fixture.world.getComponent(4, COMPONENT.Alive)!.alive = false;
  beginDemonHunterNight(fixture.world, 2, () => true);
  return fixture;
}
test("Red Moon sealed night runs all good native stages without requests or inventory changes", async () => {
  const { world, catalog } = sealedWorld();
  const before = [9, 10, 11, 12].map((id) =>
    JSON.stringify(world.getComponent(id, COMPONENT.Role)!.privateState),
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
    get requestFactory() {
      return GameActionRequestFactory;
    },
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
      JSON.stringify(world.getComponent(id, COMPONENT.Role)!.privateState),
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
  const seer = world.getComponent(9, COMPONENT.Role)!;
  const ability = (
    (seer.privateState as { readonly abilities?: unknown }).abilities as Record<string, object>
  )["native:seer_check"]!;
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
    const red = world.getComponent(4, COMPONENT.Role)!;
    const wolf = world.getComponent(1, COMPONENT.Role)!;
    if (mutation === "replace") world.addComponent(4, COMPONENT.Role, { ...red, role: wolf.role });
    else red.role = wolf.role;
    expect(() => demonRedMoonNightSealed(world, 2)).toThrow("red_moon_original_state_revoked");
  });
