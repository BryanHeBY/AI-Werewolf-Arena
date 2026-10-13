/**
 * Scenario tests for wolf team access. Inputs are original directional chat/knife policies, in-flight
 * replies and event-time audiences. Original literal receipts, reference/getter/error traces, facts and
 * expected state remain the oracle. Actual NightPipeline coordinates independently changing chat and knife
 * permissions, including an in-flight cancellation. Engine sequencing remains real and models remain
 * controlled providers; production output is not a newly generated golden.
 */
import { completedNight } from "../../engine/night_stage_fixture";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Role, type AliveComponent, type GameEvent, type RoleComponent, type World } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { RoleCatalog, getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { ToolValidationRuleRegistry } from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { ActionValidator } from "../../../src/game/gateway/action_validator";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";

const fixedRoles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];

const role = (world: World, id: number) => world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

const alive = (world: World, id: number) =>
  world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;

function fixture(locale: "zh-CN" | "en") {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale, fixedRoles });
  const catalog = new RoleCatalog(
    getDefaultRoleCatalog()
      .all()
      .map((profile) => {
        if (profile.role === Role.Seer)
          return {
            ...profile,
            nightStages: [],
            wolfTeam: (state: RoleComponent) => ({
              recognizedByPack: false,
              recognizes: "all" as const,
              canChat: false,
              canVoteForKill: state.privateState.knife === true,
            }),
          };
        if (profile.role === Role.Guard)
          return {
            ...profile,
            nightStages: [],
            wolfTeam: {
              recognizedByPack: true,
              recognizes: "none" as const,
              canChat: true,
              canVoteForKill: false,
            },
          };
        if (profile.role === Role.Villager)
          return {
            ...profile,
            wolfTeam: {
              recognizedByPack: false,
              recognizes: [Role.Seer],
              canChat: false,
              canVoteForKill: false,
            },
          };
        return profile;
      }),
  );
  for (const id of [3, 4, 5]) role(game.world, id).camp = Camp.Wolf;
  return { ...game, catalog };
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual night scheduling splits chat/knife and snapshots a mid-night grant/death`, async () => {
    const { world, catalog } = fixture(locale),
      events: GameEvent[] = [],
      asked: Array<[number, string]> = [];
    const dynamicCatalog = new RoleCatalog(
      catalog.all().map((profile) =>
        profile.role !== Role.Seer
          ? profile
          : {
              ...profile,
              nightStages: [
                {
                  id: "synthetic_grant",
                  priority: 350,
                  async execute() {
                    (role(world, 3).privateState as Record<string, unknown>).knife = true;
                    alive(world, 2).alive = false;
                  },
                },
              ],
            },
      ),
    );
    const pipeline = new NightPipeline({
      world,
      events,
      toolGateway: new ToolGateway(
        new ActionValidator(new ToolValidationRuleRegistry(undefined, dynamicCatalog)),
      ),
      damageResolutionSystem: new DamageResolutionSystem(),
      stageRegistry: new NightStageRegistry(dynamicCatalog),
    });
    const result = await pipeline.execute(
      sixPlayerMvpConfig,
      {
        async getAction(input) {
          asked.push([input.actorId, input.context.stage]);
          if (input.context.stage === "wolf_discussion")
            return {
              name: "speak_to_wolves",
              args: { text: `chat-${input.actorId}`, end_chat: true },
            };
          if (input.context.stage === "wolf_vote")
            return { name: "kill_vote", args: { target_id: 6, abstain: false } };
          throw new Error("unexpected_stage");
        },
      },
      1,
    );
    expect(
      asked
        .filter(([, stage]) => stage === "wolf_discussion")
        .map(([id]) => id)
        .sort(),
    ).toEqual([1, 2, 4]);
    expect(asked.filter(([, stage]) => stage === "wolf_vote").map(([id]) => id)).toEqual([1, 3]);
    expect(completedNight(result).summary.wolfTarget).toBe(6);
    expect(completedNight(result).damage.deaths).toEqual([6]);
    expect(
      events
        .filter((event) => event.type === "wolf_discussion_ended")
        .every((event) => JSON.stringify(event.audience) === "[1,2,4]"),
    ).toBe(true);
    expect(
      events
        .filter((event) => event.type === "wolf_kill_vote_cast")
        .map((event) => ({ actor: event.payload.actorId, audience: event.audience })),
    ).toEqual([
      { actor: 1, audience: [1, 3, 4] },
      { actor: 3, audience: [1, 3, 4] },
    ]);
    expect(
      buildAgentVisibleEventFeed(world, events, 2).some(
        (event) => event.type === "wolf_kill_vote_cast",
      ),
    ).toBe(false);
    expect(buildAgentVisibleEventFeed(world, events, 3).map((event) => event.type)).toEqual([
      "wolf_kill_vote_cast",
      "wolf_kill_vote_cast",
    ]);
  });

test("a knife revoked during an in-flight decision is not applied, retried or recorded as a repaired vote", async () => {
  const { world, catalog } = fixture("en"),
    events: GameEvent[] = [],
    asks: number[] = [];
  const pipeline = new NightPipeline({
    world,
    events,
    toolGateway: new ToolGateway(
      new ActionValidator(new ToolValidationRuleRegistry(undefined, catalog)),
    ),
    damageResolutionSystem: new DamageResolutionSystem(),
    stageRegistry: new NightStageRegistry(catalog),
  });
  const result = await pipeline.execute(
    sixPlayerMvpConfig,
    {
      async getAction(input) {
        if (input.context.stage === "wolf_discussion")
          return { name: "speak_to_wolves", args: { text: "end", end_chat: true } };
        asks.push(input.actorId);
        role(world, input.actorId).camp = Camp.Good;
        return { name: "kill_vote", args: { target_id: 6, abstain: false } };
      },
    },
    1,
  );
  expect(asks.sort()).toEqual([1, 2]);
  expect(completedNight(result).summary.wolfTarget).toBeNull();
  expect(events.filter((event) => event.type === "wolf_kill_vote_cast")).toEqual([]);
  expect(completedNight(result).damage.deaths).toEqual([]);
});
