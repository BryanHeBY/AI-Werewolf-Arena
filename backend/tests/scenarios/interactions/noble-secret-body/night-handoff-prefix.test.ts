/**
 * Interaction scenario checks Noble handoff after an actual native night.
 * Inputs are fixed players, literal valid native actions and one late result
 * getter failure; the same error, single getter read, still-open authority and
 * already-published native damage fact are the independent literal oracle.
 * Existing Demon potion delivery is executed before the failure; no fake bypass,
 * transport, model or complete-game driver supplies the expected outcome.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { nobleSecretBodyTwelveConfig } from "../../../../src/runtime/scenarios/noble_secret_body_twelve";
import { Role } from "../../../../src/core/domain/identity";
import type { BoardConfig } from "../../../../src/core/domain/board";
import type { World } from "../../../../src/core/domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { demonNightChoice } from "../../../support/demon_hunter_scenarios";
import { NightStageRegistry } from "../../../../src/rulesets/night-stage-plan";
import { checkpointNobleBodyAuthority } from "../../../../src/game/mechanisms/roles/noble_secret_body/authority";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";

test("a later result getter failure preserves the already-transferred sender prefix", async () => {
  const config = nobleSecretBodyTwelveConfig(),
    game = bootstrapGame(config, {
      fixedRoles: config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    }),
    error = new Error("noble_return_getter_rejected");
  let reads = 0;
  class Stages extends NightStageRegistry {
    override getStages(config: BoardConfig, world?: World) {
      return [
        ...super.getStages(config, world),
        {
          id: "return-getter-probe",
          priority: 1,
          async execute(ctx: NightStageContext) {
            Object.defineProperty(ctx.state, "evilKnightBindings", {
              get() {
                reads++;
                throw error;
              },
            });
          },
        },
      ];
    }
  }
  const events: GameEvent[] = [],
    pipeline = new NightPipeline({
      world: game.world,
      events,
      stageRegistry: new Stages(),
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
    });
  await expect(
    pipeline.execute(
      config,
      {
        async getAction(request) {
          if (request.allowedTools.includes("protect_secret_body"))
            return { name: "protect_secret_body", args: { target_id: null } };
          if (request.allowedTools.includes("check_identity"))
            return { name: "check_identity", args: { target_id: 6 } };
          return demonNightChoice(request, 5, { knife: null, hunt: null });
        },
      },
      1,
    ),
  ).rejects.toBe(error);
  expect(reads).toBe(1);
  expect(checkpointNobleBodyAuthority(game.world, false).nights[0]?.status).toBe("open");
  expect(events.at(-1)?.type).toBe("noble_body_native_damage_committed");
});
