import { getNightmareShadowState } from "../../../src/game/mechanisms/roles/nightmare_shadow/state";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type RoleComponent } from "../../../src/core";
import { createRandom, randomDraws } from "../../../src/core/domain/random";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ObservedBot } from "../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../src/ai/agents/providers/observed_players";
import type { PlayerObservation } from "../../../src/ai/agents/player/observation";
import { nightmareTwelveConfig } from "../../../src/runtime/scenarios/nightmare_twelve";
import {
  beginNightmareNight,
  commitNightmareFear,
} from "../../../src/game/mechanisms/roles/nightmare_shadow/night_frame";
for (const fear of ["optional", "required_when_legal"] as const)
  test(`nightmare first-fear observation is private, detached, and satisfies ${fear}`, async () => {
    const config = structuredClone(nightmareTwelveConfig);
    config.nightmareShadow!.fearActionPolicy = fear;
    const f = bootstrapGame(config);
    const id = (role: Role) =>
      f.world
        .entityIds()
        .find((id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === role)!;
    const actor = id(Role.NightmareShadow),
      villager = id(Role.Villager),
      wolf = id(Role.Wolf);
    const seen: PlayerObservation[] = [];
    const bot = new ObservedBot(randomDraws(createRandom("fear-observed")), "conservative");
    const provider = new ObservedPlayersActionProvider(
      f.world,
      new Map(
        [actor, villager].map((id) => [
          id,
          {
            async decide(o: PlayerObservation) {
              seen.push(o);
              return id === actor ? bot.decide(o) : null;
            },
          },
        ]),
      ),
      config,
    );
    const privateState = getNightmareShadowState(
      f.world.getComponent<RoleComponent>(actor, COMPONENT.Role)!,
    )!;
    Object.defineProperty(privateState.history, "map", {
      get() {
        throw new Error("nightmare_history_map_getter_executed");
      },
    });
    beginNightmareNight(f.world, 1);
    const factory = new GameActionRequestFactory(f.world, f.phaseManager.getEvents(), 1);
    const action = await provider.getAction(
      factory.create({
        actorId: actor,
        phase: Phase.Night,
        allowedTools: ["fear"],
        stage: "nightmare_fear",
        requiresAction: true,
        summary: "Fear",
      }),
    );
    expect(seen[0]!.teammateIds).toEqual([]);
    expect(seen[0]!.ownState.nightmare?.packReady).toBe(false);
    expect(action?.name).toBe("fear");
    if (action?.name !== "fear") throw new Error("missing fear");
    expect(action.args.abstain).toBe(fear === "optional");
    expect(() => {
      seen[0]!.ownState.nightmare!.history.push({ day: 99, targetId: wolf });
    }).toThrow();
    commitNightmareFear(f.world, actor, 1, wolf);
    expect(seen[0]!.ownState.nightmare!.history).toHaveLength(0);
    await provider.getAction(
      factory.create({
        actorId: villager,
        phase: Phase.Voting,
        allowedTools: ["vote"],
        stage: "voting",
        requiresAction: true,
        summary: "Vote",
      }),
    );
    expect(seen[1]!.ownState.nightmare).toBeUndefined();
  });
