/**
 * 受控夜间场景验证具名类型的觉醒提案进入实际伤害结算，且运行 scope 不进入摘要。
 * 输入为原本地角色 World 及通过完整 NightPipeline 的受控阶段注册表。
 * 输出与预期为原精确公开摘要／来源结果；阶段 mock 明确保留，不生成新预期或模型结果。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { DeathCause, Role, StatusMark, type BoardConfig } from "../../../src/domain";
import { captureNightLife, type NightAwakenedEffect } from "../../../src/domain/night-effects";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { NightPipeline } from "../../../src/engine/phases/night-pipeline";
import { NightStageRegistry } from "../../../src/rulesets/night-stage-plan";
import type { NightStageHandler } from "../../../src/engine/night/contracts";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

const roles = [Role.Wolf, Role.Witch, Role.Seer, Role.Guard, Role.Villager, Role.Villager];

const config: BoardConfig = {
  ...sixPlayerMvpConfig,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
};

const fixture = () => bootstrapGame(config, { fixedRoles: roles });

type Game = ReturnType<typeof fixture>;

const scope = (game: Game, id: number) => captureNightLife(game.world, id)!;

const effect = (game: Game, targetId: number, isCurrent = () => true): NightAwakenedEffect => ({
  actorId: 1,
  target: scope(game, targetId),
  isCurrent,
});

test("NightPipeline delivers typed awakened proposals to Damage without exposing runtime scopes in the summary", async () => {
  const game = fixture();
  class ControlledStages extends NightStageRegistry {
    override getStages(): NightStageHandler[] {
      return [
        {
          id: "controlled_damage",
          priority: 900,
          async execute(ctx) {
            ctx.state.awakenedEffects!.shields.push(effect(game, 5));
            ctx.state.awakenedEffects!.attacks.push(effect(game, 6));
            ctx.ensureMarks(5).add(StatusMark.WolfKillMark);
          },
        },
      ];
    }
  }
  const result = await new NightPipeline({
    world: game.world,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    events: [],
    stageRegistry: new ControlledStages(),
  }).execute(
    config,
    {
      async getAction() {
        throw new Error("unexpected_action_request");
      },
    },
    1,
  );
  expect(result.interrupted).toBe(false);
  if (result.interrupted) throw new Error("unexpected_interruption");
  expect(result.damage).toEqual({
    deaths: [6],
    deathSources: { 6: [DeathCause.AwakenedHiddenKnife] },
  });
  expect(result.summary).toEqual({
    wolfTarget: null,
    deaths: [6],
    seerChecks: [],
    interruptedBySelfDestruct: false,
  });
  expect(JSON.stringify(result.summary)).not.toContain('"life"');
  expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
});
