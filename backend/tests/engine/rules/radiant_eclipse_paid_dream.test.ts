import { expect, test } from "bun:test";
import { World } from "../../../src/core/domain/world";
import { Role, Camp, WitchSelfHealRule } from "../../../src/core/domain/identity";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createRoleComponent, type RoleComponent } from "../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createCampComponent } from "../../../src/core/domain/components/camp";
import { createVictoryComponent } from "../../../src/core/domain/components/victory";
import {
  installNativeAbility,
  findNightAbility,
  abilityStatus,
  type NightAbility,
} from "../../../src/game/mechanisms/roles/abilities";
import {
  createEclipseState,
  createShelterState,
} from "../../../src/game/mechanisms/roles/radiant_eclipse/state";
import {
  installRadiantEclipseBoard,
  beginRadiantNight,
  openEclipseChoice,
  commitEclipseChoice,
  captureRadiantTurn,
  closeRadiantNight,
  commitRadiantShelter,
  sealRadiantNightEffects,
} from "../../../src/game/mechanisms/roles/radiant_eclipse/night_frame";
import type { GameEvent } from "../../../src/core/domain/events";
function fixture() {
  const world = new World();
  const roles = [
    Role.EclipseMaid,
    Role.RadiantCount,
    Role.Seer,
    Role.Witch,
    Role.Dreamer,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Wolf,
    Role.Wolf,
    Role.Wolf,
  ];
  for (const kind of roles) {
    const id = world.createEntity(),
      camp = kind === Role.EclipseMaid || kind === Role.Wolf ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(kind, camp);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, {
      id,
      seat: id,
      name: `synthetic-${id}`,
      sessionId: "synthetic",
    });
    if (kind === Role.EclipseMaid) {
      role.privateState.eclipse = createEclipseState();
      role.privateState.abilities = {};
    }
    if (kind === Role.RadiantCount) installNativeAbility(role, "shelter", createShelterState());
    if (kind === Role.Seer)
      installNativeAbility(role, "seer_check", {
        lastTarget: null,
        lastIsWerewolf: null,
        history: [],
      });
    if (kind === Role.Witch)
      installNativeAbility(role, "potion", {
        heal: 1,
        poison: 0,
        selfHealRule: WitchSelfHealRule.Disabled,
        canSelfHeal: false,
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      });
    if (kind === Role.Dreamer)
      installNativeAbility(role, "dream", {
        lastTarget: 6,
        lastDay: 1,
        history: [{ day: 1, targetId: 6 }],
        protectionPolicy: "netease_2026_night_immunity_v1",
      });
  }
  const role = (id: number) => world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
  const events: GameEvent[] = [];
  installRadiantEclipseBoard(world);
  return { world, role, events };
}

import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import { ECLIPSE_SWALLOW_STAGE } from "../../../src/game/mechanisms/roles/radiant_eclipse/night_stages";
import { DREAMER_NIGHT_STAGE } from "../../../src/game/mechanisms/roles/dreamer/night_stages";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import type { ActionProvider, BoardConfig } from "../../../src/core/domain/model";
class Stages extends NightStageRegistry {
  override getStages() {
    return [ECLIPSE_SWALLOW_STAGE, DREAMER_NIGHT_STAGE];
  }
}
const config = {
  boardSize: 12,
  enableSheriff: false,
  hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
  roleSetups: [],
  radiantEclipse: { policy: "awa_radiant_eclipse_v1" },
} as BoardConfig;

import { DreamNightFrame } from "../../../src/game/mechanisms/roles/dreamer/night_frame";
import { StatusMark, DeathCause } from "../../../src/core/domain/model";
const provider: ActionProvider = {
  getAction: async (request) => {
    if (request.context.stage === "eclipse_swallow")
      return { name: "swallow_skill", args: { target_id: 5 } };
    if (request.context.stage === "dreamer") return { name: "dream", args: { target_id: 7 } };
    throw new Error("unexpected_request");
  },
};
for (const dead of [1, 5])
  test(`paid borrowed Dream after committed close follows actual caster ${dead}`, async () => {
    const f = fixture();
    class DamageStages extends Stages {
      override getStages() {
        return [
          ...super.getStages(),
          {
            id: "synthetic_attack",
            priority: 999,
            async execute(ctx: any) {
              ctx.ensureMarks(dead).add(StatusMark.PoisonMark);
            },
          },
        ];
      }
    }
    const result = await new NightPipeline({
      world: f.world,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
      events: f.events,
      stageRegistry: new DamageStages(),
    }).execute(config, provider, 2);
    expect(result.interrupted).toBe(false);
    if (result.interrupted) throw new Error("unexpected_interrupt");
    expect(result.damage.deaths).toEqual(dead === 1 ? [1, 7] : [5]);
    expect(result.damage.deathSources).toEqual(
      dead === 1 ? { 1: [DeathCause.Poison], 7: [DeathCause.Dream] } : { 5: [DeathCause.Poison] },
    );
    const borrowed = findNightAbility(f.role(1), "dream")!,
      native = findNightAbility(f.role(5), "dream")!;
    expect(borrowed.disabled).toBe(true);
    expect(native.nightSuppression).toBeUndefined();
    expect(native.state).toEqual({
      lastTarget: 6,
      lastDay: 1,
      history: [{ day: 1, targetId: 6 }],
      protectionPolicy: "netease_2026_night_immunity_v1",
    });
    expect(result.dreamFrame.protectedTargets(f.world)).toEqual([7]);
    const life = f.world.getComponent<any>(dead, COMPONENT.Alive)!;
    life.alive = false;
    expect(result.dreamFrame.linkedDeaths(f.world, [dead])).toEqual(dead === 1 ? [7] : []);
    expect(
      f.events.filter((e) => e.type === "eclipse_lease_closed").map((e) => e.payload.status),
    ).toEqual(["committed"]);
    expect(
      f.events.filter((e) => e.type === "eclipse_native_restored").map((e) => e.payload.playerId),
    ).toEqual([5]);
  });
test("actual later-stage failure retains paid Dream fact and stock but revokes handed-out effect", async () => {
  const f = fixture();
  let links: any[] = [];
  class FailStages extends Stages {
    override getStages() {
      return [
        ...super.getStages(),
        {
          id: "synthetic_failure",
          priority: 999,
          async execute(ctx: any) {
            links = ctx.state.dreamLinks;
            throw new Error("synthetic_after_payment");
          },
        },
      ];
    }
  }
  await expect(
    new NightPipeline({
      world: f.world,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
      events: f.events,
      stageRegistry: new FailStages(),
    }).execute(config, provider, 2),
  ).rejects.toThrow("synthetic_after_payment");
  const borrowed = findNightAbility(f.role(1), "dream")!,
    native = findNightAbility(f.role(5), "dream")!,
    frame = new DreamNightFrame(links);
  expect(borrowed.disabled).toBe(true);
  expect(native.nightSuppression).toBeUndefined();
  expect(borrowed.uses).toBe(1);
  expect(borrowed.state.history).toEqual([{ day: 2, targetId: 7 }]);
  expect(frame.protectedTargets(f.world)).toEqual([]);
  expect(frame.linkedDeaths(f.world, [1])).toEqual([]);
  expect(f.events.filter((e) => e.type === "dream_applied").map((e) => e.payload)).toEqual([
    { actorId: 1, targetId: 7, day: 2, consecutive: false, abilityId: borrowed.id },
  ]);
  expect(
    f.events.filter((e) => e.type === "eclipse_lease_closed").map((e) => e.payload.status),
  ).toEqual(["aborted"]);
  expect(
    f.events.filter((e) =>
      ["eclipse_native_restored", "night_resolved", "game_over"].includes(e.type),
    ),
  ).toEqual([]);
});
