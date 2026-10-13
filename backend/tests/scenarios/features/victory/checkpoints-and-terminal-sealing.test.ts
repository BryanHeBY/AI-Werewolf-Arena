/**
 * Full phase scenarios check declared victory checkpoints, one terminal event and forged membership refusal. Inputs are original custom conditions and scripted player actions; fixed result/event clones, max-day point and no-post-terminal-action expectations are the oracle. Original World/manager lifetime is retained without models.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Camp, Phase, Role, WinCondition, createVictoryComponent, type ActionRequest } from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { ConditionRegistry } from "../../../../src/core/domain/registries/condition_registry";
import { WinConditionRegistry } from "../../../../src/game/mechanisms/registries/win_condition_registry";
import { victoryDecision } from "../../../../src/game/mechanisms/win_conditions/results";
import { PhaseManager } from "../../../../src/game/engine/phase_manager";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { createDefaultRoleRegistry } from "../../../../src/game/mechanisms";

const deck = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];

const fixture = (locale: "zh-CN" | "en") =>
  bootstrapGame(
    { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] },
    { locale, fixedRoles: deck },
  );

const action = (request: ActionRequest) =>
  request.allowedTools.includes("kill_vote")
    ? { name: "kill_vote" as const, args: { target_id: null, abstain: true } }
    : request.allowedTools.includes("guard")
      ? { name: "guard" as const, args: { target_id: null, abstain: true } }
      : request.allowedTools.includes("check_identity")
        ? { name: "check_identity" as const, args: { target_id: 1 } }
        : request.allowedTools.includes("speak")
          ? { name: "speak" as const, args: { text: "raw" } }
          : null;

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["individual", "relationship"] as const)
    test(`${locale}/${kind}: injected goal rules only win at their declared checkpoint and the engine seals immutable result/event copies`, async () => {
      const { world } = fixture(locale),
        config = { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] };
      const target =
        kind === "individual"
          ? { kind, playerId: 5, goalId: "scenario_solo" }
          : { kind, groupId: "scenario_pair" };
      if (kind === "individual")
        world.addComponent(
          5,
          COMPONENT.Victory,
          createVictoryComponent([{ kind, goalId: "scenario_solo" }]),
        );
      else
        for (const id of [5, 6])
          world.addComponent(
            id,
            COMPONENT.Victory,
            createVictoryComponent([{ kind, groupId: "scenario_pair" }]),
          );
      const checkpoint = kind === "individual" ? "exile_settled" : "night_settled";
      const registry = new ConditionRegistry(
        new WinConditionRegistry([
          {
            id: WinCondition.SlaughterCity,
            checkpoints: [checkpoint],
            evaluate: () => victoryDecision(world, target, "scenario_goal"),
          },
        ]),
      );
      expect(registry.evaluate(world, WinCondition.SlaughterCity)).toBeNull();
      expect(registry.evaluate(world, WinCondition.SlaughterCity, "day_interrupted")).toBeNull();
      const manager = new PhaseManager(
        world,
        config,
        new ToolGateway(),
        createDefaultRoleRegistry(),
        registry,
        new DamageResolutionSystem(),
      );
      const result = await manager.runSingleCycle({
        async getAction(request) {
          return request.allowedTools.includes("vote")
            ? { name: "vote", args: { target_id: 5, abstain: false } }
            : action(request);
        },
      });
      expect(result.gameOver).toBe(true);
      expect(result.result!.winner).toBeNull();
      expect(result.result!.outcome).toEqual({
        kind: "victory",
        primary: { ...target, winningPlayerIds: kind === "individual" ? [5] : [5, 6] },
        additional: [],
        winningPlayerIds: kind === "individual" ? [5] : [5, 6],
      });
      expect(result.result!.decidedAt).toEqual({
        day: 1,
        phase: kind === "individual" ? Phase.Voting : Phase.Day,
        checkpoint,
      });
      const resultBefore = structuredClone(result.result!);
      if (result.result!.outcome.kind === "victory")
        result.result!.outcome.winningPlayerIds.length = 0;
      expect(manager.debugResult()).toEqual(resultBefore);
      const event = manager.getEvents().find((event) => event.type === "game_over")!;
      expect(event.payload).toEqual(resultBefore);
      if (event.payload.outcome.kind === "victory")
        event.payload.outcome.winningPlayerIds.length = 0;
      expect(manager.debugResult()).toEqual(resultBefore);
      expect(manager.getEvents().find((event) => event.type === "game_over")!.payload).toEqual(
        resultBefore,
      );
      const before = manager.getEvents().length;
      await manager.runSingleCycle({
        async getAction() {
          throw new Error("unexpected-post-terminal-request");
        },
      });
      expect(manager.getEvents().length).toBe(before);
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: max-day termination has an explicit no-winner point and exactly one terminal event`, async () => {
    const game = fixture(locale),
      provider = {
        async getAction(request: ActionRequest) {
          return request.allowedTools.includes("vote")
            ? { name: "vote" as const, args: { target_id: null, abstain: true } }
            : action(request);
        },
      };
    await game.phaseManager.runSingleCycle(provider, 1);
    const result = await game.phaseManager.runSingleCycle(provider, 1);
    expect(result.result).toEqual({
      winner: null,
      reason: "max_days_reached",
      outcome: { kind: "no_winner" },
      decidedAt: { day: 2, phase: Phase.Night, checkpoint: "max_days_reached" },
    });
    expect(
      game.phaseManager.getEvents().filter((event) => event.type === "game_over"),
    ).toHaveLength(1);
    expect(game.world.activeDeathActionCount).toBe(0);
  });

test("final sealing rejects a structurally valid forged membership even from a custom condition", async () => {
  const { world } = fixture("en"),
    config = { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] };
  const registry = new ConditionRegistry(
    new WinConditionRegistry([
      {
        id: WinCondition.SlaughterCity,
        evaluate: () => ({
          winner: Camp.Good,
          reason: "scenario_forged",
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction: "good", winningPlayerIds: [1] },
            additional: [],
            winningPlayerIds: [1],
          },
        }),
      },
    ]),
  );
  const manager = new PhaseManager(
    world,
    config,
    new ToolGateway(),
    createDefaultRoleRegistry(),
    registry,
    new DamageResolutionSystem(),
  );
  await expect(
    manager.runSingleCycle({
      async getAction(request) {
        return action(request);
      },
    }),
  ).rejects.toThrow("game_result_membership_invalid");
  expect(manager.getSnapshot().gameOver).toBe(false);
  expect(manager.getEvents().filter((event) => event.type === "game_over")).toEqual([]);
});
