/**
 * 场景测试：验证明辉借用梦的 pending 决策与被拒的嵌套流水线。
 * 输入为原受控 provider、借用资源与实际 NightPipeline；输出以字面回执、引用和清理顺序验收。
 * 外层完整夜仍真实运行，嵌套进入应拒绝；实例入口迁移不改变已付资格和生命周期。
 * 不调用模型／网络，也不以新生产输出重写 fixture 或 golden。
 */
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { Role, Camp, WitchSelfHealRule } from "../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import {
  createRoleComponent,
  type RoleComponent,
} from "../../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import { createCampComponent } from "../../../../src/core/domain/components/camp";
import { createVictoryComponent } from "../../../../src/core/domain/components/victory";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import { installNativeAbility } from "../../../../src/game/mechanisms/roles/ability_changes";
import {
  createEclipseState,
  createShelterState,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/state";
import { installRadiantEclipseBoard } from "../../../../src/game/mechanisms/roles/radiant_eclipse/night_frame";
import type { GameEvent } from "../../../../src/core/domain/events";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { NightStageRegistry } from "../../../../src/game/mechanisms/stages/night/night_stage_registry";
import { ECLIPSE_SWALLOW_STAGE } from "../../../../src/game/mechanisms/roles/radiant_eclipse/night_stages";
import { DREAMER_NIGHT_STAGE } from "../../../../src/game/mechanisms/roles/dreamer/night_stages";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import type { ActionProvider, BoardConfig } from "../../../../src/core/domain/model";

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
  const role = (id: number) => world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
  const events: GameEvent[] = [];
  installRadiantEclipseBoard(world);
  return { world, role, events };
}

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

test("rejected actual pipeline reentry must not abort the original pending borrowed Dream lease", async () => {
  const f = fixture(),
    pipeline = new NightPipeline({
      world: f.world,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
      events: f.events,
      stageRegistry: new Stages(),
    });
  const provider: ActionProvider = {
    getAction: async (request) => {
      if (request.context.stage === "eclipse_swallow")
        return { name: "swallow_skill", args: { target_id: 5 } };
      if (request.context.stage === "dreamer") {
        const borrowed = findNightAbility(f.role(1), "dream")!,
          source = findNightAbility(f.role(5), "dream")!;
        expect(borrowed.disabled).toBe(false);
        expect(source.nightSuppression).toBeDefined();
        await expect(
          pipeline.execute(
            config,
            {
              getAction: async () => {
                throw new Error("must_not_request");
              },
            },
            2,
          ),
        ).rejects.toThrow("radiant_night_reentry");
        expect(source.nightSuppression).toBeDefined();
        expect(borrowed.disabled).toBe(false);
        expect(f.events.filter((e) => e.type === "eclipse_lease_closed")).toHaveLength(0);
        return { name: "dream", args: { target_id: 7 } };
      }
      throw new Error("unexpected_request");
    },
  };
  const result = await pipeline.execute(config, provider, 2);
  expect(result.interrupted).toBe(false);
});
