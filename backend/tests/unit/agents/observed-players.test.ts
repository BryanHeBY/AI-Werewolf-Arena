/**
 * Unit tests for observed-players; In-memory observed-players decision/turn/client control with supplied mocks or DTOs; no physical transport.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type AliveComponent, type RoleComponent } from "../../../src/core";
import { createRandom, randomDraws } from "../../../src/core/domain/random";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ObservedBot } from "../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../src/ai/agents/providers/observed_players";
import type { PlayerObservation } from "../../../src/ai/agents/player/observation";
import { getGuardState } from "../../../src/game/mechanisms/roles/private_state";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

const fixedRoles = [Role.Villager, Role.Wolf, Role.Guard, Role.Wolf, Role.Seer, Role.Villager];

test("hidden opponent identities and private state cannot change a villager observation or decision", async () => {
  const first = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("observation"),
  });
  const second = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("observation"),
  });
  const wolf = second.world.getComponent<RoleComponent>(2, COMPONENT.Role)!;
  const guard = second.world.getComponent<RoleComponent>(3, COMPONENT.Role)!;
  second.world.addComponent(2, COMPONENT.Role, guard);
  second.world.addComponent(3, COMPONENT.Role, wolf);
  (
    second.world.getComponent<RoleComponent>(5, COMPONENT.Role)!.privateState as Record<
      string,
      unknown
    >
  ).hiddenTest = "PRIVATE_OPPONENT_STATE";
  // An unannounced state change cannot be promoted into public knowledge by the observer adapter.
  second.world.getComponent<AliveComponent>(6, COMPONENT.Alive)!.alive = false;
  const observed: PlayerObservation[] = [];
  const actions = [];
  for (const context of [first, second]) {
    const bot = new ObservedBot(randomDraws(createRandom("decision")), "active");
    const provider = new ObservedPlayersActionProvider(
      context.world,
      new Map([
        [
          1,
          {
            async decide(observation: PlayerObservation) {
              observed.push(observation);
              return bot.decide(observation);
            },
          },
        ],
      ]),
      sixPlayerMvpConfig,
    );
    const requests = new GameActionRequestFactory(
      context.world,
      context.phaseManager.getEvents(),
      1,
    );
    actions.push(
      await provider.getAction(
        requests.create({
          actorId: 1,
          phase: Phase.Voting,
          allowedTools: ["vote"],
          stage: "voting",
          requiresAction: true,
          summary: "Vote",
        }),
      ),
    );
  }
  expect(observed[1]).toEqual(observed[0]);
  expect(actions[1]).toEqual(actions[0]);
  expect(observed[0].identity.role).toBe(Role.Villager);
  expect(observed[0].ownState).toEqual({});
  expect(observed[0].teammateIds).toEqual([]);
  expect(observed[0].knownAliveIds).toContain(6);
  expect(JSON.stringify(observed)).not.toContain("PRIVATE_OPPONENT_STATE");
  expect(
    observed[0].request.context.visible_events.some(
      (event) => event.type === "god_private_game_info",
    ),
  ).toBe(false);
});

test("own skill resources are detached and immutable, while teammate knowledge is authorized", async () => {
  const context = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("own-state"),
  });
  const observations: PlayerObservation[] = [];
  const strategies = new Map(
    [2, 3].map((id) => [
      id,
      {
        async decide(observation: PlayerObservation) {
          observations.push(observation);
          return null;
        },
      },
    ]),
  );
  const provider = new ObservedPlayersActionProvider(context.world, strategies, sixPlayerMvpConfig);
  const factory = new GameActionRequestFactory(context.world, context.phaseManager.getEvents(), 1);
  await provider.getAction(
    factory.create({
      actorId: 3,
      phase: Phase.Night,
      allowedTools: ["guard"],
      stage: "guard",
      requiresAction: true,
      summary: "Guard",
    }),
  );
  expect(observations[0].ownState.guard).toEqual({ lastTarget: null });
  expect(() => {
    observations[0].ownState.guard!.lastTarget = 99;
  }).toThrow();
  expect(
    getGuardState(context.world.getComponent<RoleComponent>(3, COMPONENT.Role)!)?.lastTarget,
  ).toBeNull();
  await provider.getAction(
    factory.create({
      actorId: 2,
      phase: Phase.Night,
      allowedTools: ["kill_vote"],
      stage: "wolf_vote",
      requiresAction: true,
      summary: "Wolf vote",
    }),
  );
  expect(observations[1].teammateIds).toEqual([4]);
  expect(observations[1].identity.role).toBe(Role.Wolf);
  expect(observations[1].ownState).toEqual({});
});

test("a wolf cannot infer a teammate's unannounced death from identity knowledge", async () => {
  const first = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("wolf-observation"),
  });
  const second = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("wolf-observation"),
  });
  second.world.getComponent<AliveComponent>(4, COMPONENT.Alive)!.alive = false;
  const observed: PlayerObservation[] = [];
  const actions = [];
  for (const context of [first, second]) {
    const bot = new ObservedBot(randomDraws(createRandom("wolf-decision")), "active");
    const provider = new ObservedPlayersActionProvider(
      context.world,
      new Map([
        [
          2,
          {
            async decide(observation: PlayerObservation) {
              observed.push(observation);
              return bot.decide(observation);
            },
          },
        ],
      ]),
      sixPlayerMvpConfig,
    );
    const requests = new GameActionRequestFactory(
      context.world,
      context.phaseManager.getEvents(),
      1,
    );
    actions.push(
      await provider.getAction(
        requests.create({
          actorId: 2,
          phase: Phase.Night,
          allowedTools: ["kill_vote"],
          stage: "wolf_vote",
          requiresAction: true,
          summary: "Kill vote",
        }),
      ),
    );
  }
  expect(observed[1]).toEqual(observed[0]);
  expect(actions[1]).toEqual(actions[0]);
  expect(observed[1].teammateIds).toEqual([4]);
  expect(observed[1].knownAliveIds).toContain(4);
});

test("a decision RNG capability has no seed, path or access to other streams", () => {
  const source = createRandom("PRIVATE_GAME_SEED").fork("players").fork("id:1");
  const capability = randomDraws(source);
  expect(Object.keys(capability)).toEqual(["next"]);
  expect("metadata" in capability).toBe(false);
  expect("fork" in capability).toBe(false);
  expect(JSON.stringify(capability)).not.toContain("PRIVATE_GAME_SEED");
  const reference = createRandom("PRIVATE_GAME_SEED").fork("players").fork("id:1");
  expect(capability.next()).toBe(reference.next());
  expect(capability.next()).toBe(reference.next());
});

test("a neutral public shot updates observer knowledge and excludes the victim from decisions", async () => {
  const context = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("public-shot"),
  });
  const events = [
    { timestamp: 1, type: "player_shot" as const, payload: { actorId: 3, targetId: 2 } },
  ];
  const observations: PlayerObservation[] = [];
  const provider = new ObservedPlayersActionProvider(
    context.world,
    new Map([
      [
        1,
        {
          async decide(observation: PlayerObservation) {
            observations.push(observation);
            return new ObservedBot(randomDraws(createRandom("shot-vote")), "active").decide(
              observation,
            );
          },
        },
      ],
    ]),
    sixPlayerMvpConfig,
  );
  const factory = new GameActionRequestFactory(context.world, events, 1);
  const action = await provider.getAction(
    factory.create({
      actorId: 1,
      phase: Phase.Voting,
      allowedTools: ["vote"],
      stage: "voting",
      requiresAction: true,
      summary: "Vote",
    }),
  );
  expect(observations[0].request.context.visible_events).toEqual([
    { seq: 1, type: "player_shot", payload: { actorId: 3, targetId: 2 } },
  ]);
  expect(observations[0].knownAliveIds).toEqual([1, 3, 4, 5, 6]);
  if (action?.name !== "vote") throw new Error("expected_vote");
  expect(action.args.target_id).not.toBe(2);
});
