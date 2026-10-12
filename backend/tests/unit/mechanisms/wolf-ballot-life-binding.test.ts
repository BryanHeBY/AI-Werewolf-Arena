/**
 * Unit tests verify the direct wolf ballot stage counts only the original target life and a fresh valid replacement ballot.
 * Input: Original mutation matrix, bounded night-stage context and controlled second voter callbacks.
 * Output and oracle: Exact collected vote/target identity outcomes preserve original assertions; no whole NightPipeline, PM cycle or model runs.
 */
import type { NightStageState } from "../../../src/game/mechanisms/stages/night/contracts";
import { nightStageContext } from "../../engine/night_stage_fixture";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, Phase, WinCondition, COMPONENT, type BoardConfig, type GameEvent, StatusMark } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { WOLF_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/wolf/night_stages";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";

const config = (deck: Role[]): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: deck.length,
  winConditions: [WinCondition.SlaughterSide],
  roleSetups: [...new Set(deck)].map((role) => ({
    role,
    count: deck.filter((r) => r === role).length,
  })),
  selfDestruct: { enabledWindows: [] },
});

for (const mutation of ["revive", "replace_life"] as const)
  test(`${mutation}: second ordinary voter cannot redirect an already collected ballot to a new target life`, async () => {
    const deck = [Role.Wolf, Role.Wolf, Role.Seer, Role.Bear, Role.Villager, Role.Villager],
      game = bootstrapGame(config(deck), { fixedRoles: deck }),
      events: GameEvent[] = [];
    const state: NightStageState = {
      wolfChatOrder: [1, 2],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      dreamLinks: [],
    };
    await WOLF_NIGHT_STAGES[1]!.execute(
      nightStageContext({
        world: game.world,
        roleCatalog: getDefaultRoleCatalog(),
        toolGateway: new ToolGateway(),
        events,
        actionProvider: {
          async getAction(request) {
            if (request.actorId === 1)
              return { name: "kill_vote", args: { target_id: 5, abstain: false } };
            if (mutation === "replace_life")
              game.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
            else {
              const life = game.world.getComponent<{ alive: boolean }>(5, COMPONENT.Alive)!;
              life.alive = false;
              life.alive = true;
            }
            return { name: "kill_vote", args: { target_id: null, abstain: true } };
          },
        },
        isCurrent: () => true,
        currentDay: () => 1,
        makeRequest: (actorId) => ({
          actorId,
          phase: Phase.Night,
          allowedTools: ["kill_vote"],
          context: { day: 1, stage: "wolf_vote", visible_events: [], turn_constraints: {} },
        }),
        getAliveByRole: () => [],
        ensureMarks: (id) => {
          let marks = game.world.getComponent<StatusMarksComponent>(id, COMPONENT.StatusMarks);
          if (!marks) {
            marks = new StatusMarksComponent();
            game.world.addComponent(id, COMPONENT.StatusMarks, marks);
          }
          return marks;
        },
        pickMajorityTarget: (votes) =>
          Object.keys(votes).length ? Number(Object.keys(votes)[0]) : null,
        shuffleWolves: (ids) => ids,
        state,
      }),
    );
    expect(events.filter((e) => e.type === "wolf_kill_vote_cast")).toHaveLength(2);
    expect(events.filter((e) => e.type === "wolf_kill_vote_cast")[1]!.payload).toMatchObject({
      actorId: 2,
      abstain: true,
      targetId: null,
    });
    expect(
      game.world
        .getComponent<StatusMarksComponent>(5, COMPONENT.StatusMarks)
        ?.has(StatusMark.WolfKillMark) ?? false,
    ).toBe(false);
  });

for (const mutation of ["revive", "replace_life"] as const)
  test(`${mutation}: a new valid ballot for the same ID counts once without borrowing its old-life ballot`, async () => {
    const deck = [Role.Wolf, Role.Wolf, Role.Wolf, Role.Bear, Role.Villager, Role.Villager],
      game = bootstrapGame(config(deck), { fixedRoles: deck }),
      events: GameEvent[] = [],
      state: NightStageState = {
        wolfChatOrder: [1, 2, 3],
        endedWolves: new Set(),
        wolfVotes: {},
        wolfTarget: null,
        seerChecks: [],
        dreamLinks: [],
      };
    await WOLF_NIGHT_STAGES[1]!.execute(
      nightStageContext({
        world: game.world,
        roleCatalog: getDefaultRoleCatalog(),
        toolGateway: new ToolGateway(),
        events,
        actionProvider: {
          async getAction(request) {
            if (request.actorId === 2) {
              if (mutation === "replace_life")
                game.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
              else {
                const life = game.world.getComponent<{ alive: boolean }>(5, COMPONENT.Alive)!;
                life.alive = false;
                life.alive = true;
              }
            }
            return {
              name: "kill_vote",
              args: { target_id: request.actorId === 2 ? 6 : 5, abstain: false },
            };
          },
        },
        isCurrent: () => true,
        currentDay: () => 1,
        makeRequest: (actorId) => ({
          actorId,
          phase: Phase.Night,
          allowedTools: ["kill_vote"],
          context: { day: 1, stage: "wolf_vote", visible_events: [], turn_constraints: {} },
        }),
        getAliveByRole: () => [],
        ensureMarks: (id) =>
          game.world.getComponent<StatusMarksComponent>(id, COMPONENT.StatusMarks)!,
        pickMajorityTarget: (votes) => Math.min(...Object.keys(votes).map(Number)),
        shuffleWolves: (ids) => ids,
        state,
      }),
    );
    expect(state.wolfVotes).toEqual({ 5: 1, 6: 1 });
    expect(state.wolfTarget).toBe(5);
    expect(
      events
        .filter((e) => e.type === "wolf_kill_vote_cast")
        .map((e) => [e.payload.actorId, e.payload.targetId]),
    ).toEqual([
      [1, 5],
      [2, 6],
      [3, 5],
    ]);
    expect(
      game.world
        .getComponent<StatusMarksComponent>(5, COMPONENT.StatusMarks)!
        .has(StatusMark.WolfKillMark),
    ).toBe(true);
  });
