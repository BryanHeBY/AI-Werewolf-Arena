/**
 * 场景测试：验证明辉吞噬梦的已付效果与后续死亡／失败阶段。
 * 输入为公开板子经真实解析的配置、原捕获 DreamFrame、实际 NightPipeline 和受控 provider；输出用字面状态与错误 trace 验收。
 * 施法者生命、库存付款和晚阶段失败保持因果顺序，场景不是独立纯 reader。
 * 不调用模型／网络，不生成或重写原预期数据。
 */
import { createAliveComponent, createCampComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { World } from "../../../../src/domain/world";
import { Role, Camp, WitchSelfHealRule } from "../../../../src/domain/identity";
import { COMPONENT } from "../../../../src/domain/components/names";
import { type RoleComponent } from "../../../../src/domain/components/role";
import { createRoleComponent } from "../../../../src/agents/observation/role-presentation";


import { createVictoryComponent } from "../../../../src/domain/components/victory";
import { findNightAbility } from "../../../../src/features/night-abilities/abilities";
import { installNativeAbility } from "../../../../src/features/night-abilities/ability-changes";
import { createEclipseState } from "../../../../src/features/radiant-eclipse/eclipse-state-slot";
import { createShelterState } from "../../../../src/features/radiant-eclipse/shelter-state";
import { installRadiantEclipseBoard } from "../../../../src/features/radiant-eclipse/night-frame";
import type { GameEvent } from "../../../../src/domain/events";
import { NightPipeline } from "../../../../src/engine/phases/night-pipeline";
import { NightStageRegistry } from "../../../../src/rulesets/night-stage-plan";
import { ECLIPSE_SWALLOW_STAGE } from "../../../../src/features/radiant-eclipse/night-stages";
import { DREAMER_NIGHT_STAGE } from "../../../../src/features/dreamer/night-stages";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import type { ActionProvider } from "../../../../src/domain/model";
import { DreamNightFrame, type DreamNightLink } from "../../../../src/features/dreamer/night-frame";
import { readDreamNightLinks } from "../../../../src/features/dreamer/night-ports";
import { StatusMark, DeathCause } from "../../../../src/domain/model";

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
      role = createRoleComponent(kind);
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
      (role.privateState as Record<string, unknown>).eclipse = createEclipseState();
      (role.privateState as Record<string, unknown>).abilities = {};
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
  const role = (id: number) => world.getComponent(id, COMPONENT.Role)!;
  const events: GameEvent[] = [];
  installRadiantEclipseBoard(world);
  return { world, role, events };
}

class Stages extends NightStageRegistry {
  override getStages() {
    return [ECLIPSE_SWALLOW_STAGE, DREAMER_NIGHT_STAGE];
  }
}

// 配置经真实公开板子解析，带齐阵容、警长与固定政策，满足现有有限准入。
// 场景仍固定原玩家与已付库存历史，不从通用模拟器重新生成动作或断言。
const config = parseBoardDefinition(
  JSON.parse(
    readFileSync(
      new URL("../../../../../configs.example/boards/awa_radiant_eclipse_12_v1.json", import.meta.url),
      "utf8",
    ),
  ),
).config;

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
    const life = f.world.getComponent(dead, COMPONENT.Alive)!;
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
  let links: readonly DreamNightLink[] = [];
  class FailStages extends Stages {
    override getStages() {
      return [
        ...super.getStages(),
        {
          id: "synthetic_failure",
          priority: 999,
          async execute(ctx: any) {
            links = readDreamNightLinks(ctx.state);
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
