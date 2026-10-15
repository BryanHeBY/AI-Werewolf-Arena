/**
 * 场景测试：验证明辉借用梦的 pending 决策与被拒的嵌套流水线。
 * 输入为原受控 provider、借用资源与实际 NightPipeline；输出以字面回执、引用和清理顺序验收。
 * 外层完整夜仍真实运行，嵌套进入应拒绝；实例入口迁移不改变已付资格和生命周期。
 * 不调用模型／网络，也不以新生产输出重写 fixture 或 golden。
 */
import {
  createAliveComponent,
  createCampComponent,
} from "../../../../src/agents/observation/component-presentation";
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

// 使用已交付的完整公开板子通过现有有限准入；仍由原手写 World、两阶段与字面重入预期驱动本场景。
const config = parseBoardDefinition(
  JSON.parse(
    readFileSync(
      new URL(
        "../../../../../configs.example/boards/awa_radiant_eclipse_12_v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
).config;

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
