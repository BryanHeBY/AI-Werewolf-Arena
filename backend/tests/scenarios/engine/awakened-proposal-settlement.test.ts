/**
 * Controlled Night scenario verifies typed Awakened proposals reach actual damage settlement without runtime scopes entering summaries.
 * Input: Original local role world and controlled stage registry through the complete NightPipeline.
 * Output and oracle: Exact public summary/source results remain unchanged; the stage mocks are explicit, no new expectation or model is generated.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { DeathCause, Role, StatusMark, type BoardConfig } from "../../../src/core";
import { captureNightLife, type NightAwakenedEffect } from "../../../src/core/domain/night_effects";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { NightStageRegistry } from "../../../src/rulesets/night-stage-plan";
import type { NightStageHandler } from "../../../src/game/mechanisms/stages/night/contracts";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

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
