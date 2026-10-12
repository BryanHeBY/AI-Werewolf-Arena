/**
 * Unit tests verify initial sheriff configuration and bounded vote/death badge lifecycle under the original sheriff pipeline describe prefix.
 * Input: Original local worlds, explicit badge/vote/life edits and controlled direct DeathResolution operations.
 * Output and oracle: Literal canonical election, transfer/destroy and Idiot reveal assertions remain unchanged; no complete Day pipeline or model executes.
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { AliveComponent } from "../../../src/core/domain/components/alive";
import { BadgeComponent } from "../../../src/core/domain/components/badge";
import { VotingRightComponent } from "../../../src/core/domain/components/voting_right";
import { RoleComponent } from "../../../src/core/domain/components/role";
import { DeathCause, Phase } from "../../../src/core/domain/model";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";

describe("sheriff pipeline", () => {
  test("no initial sheriff before election", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const sheriffId = world
      .entityIds()
      .find((id) => world.getComponent<BadgeComponent>(id, COMPONENT.Badge)?.isSheriff);

    expect(sheriffId).toBeUndefined();
  });

  test("initial sheriff assignment emits a canonical replay election event", () => {
    const config = { ...twelvePlayerStandardConfig, initialSheriffSeat: 1 };
    const context = bootstrapGame(config);
    const sheriffId = context.playerIds.find(
      (id) => context.world.getComponent<{ seat: number }>(id, COMPONENT.Identity)?.seat === 1,
    );
    const event = context.phaseManager.getEvents().find((item) => item.type === "sheriff_elected");

    expect(sheriffId).toBeDefined();
    if (sheriffId === undefined) throw new Error("missing_initial_sheriff_fixture");
    expect(event?.payload).toEqual({ winnerId: sheriffId, source: "initial_configuration" });
  });

  test("sheriff voted out triggers badge transfer to next alive voter", async () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const registry = new EventRegistry();

    const sheriffId = world
      .entityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role !== "idiot")!;
    const sheriffBadge = world.getComponent<BadgeComponent>(sheriffId, COMPONENT.Badge)!;
    sheriffBadge.isSheriff = true;
    sheriffBadge.destroyed = false;
    const sheriffVoting = world.getComponent<VotingRightComponent>(
      sheriffId,
      COMPONENT.VotingRight,
    )!;
    sheriffVoting.weight = 1.5;

    const result = registry.onVotedOut(world, sheriffId, events);
    expect(result.prevented).toBe(false);
    expect(result.removed).toEqual([sheriffId]);

    expect(world.getComponent<AliveComponent>(sheriffId, COMPONENT.Alive)!.alive).toBe(true);
    expect(events).toEqual([]);
    await new DeathResolution(world, events, new ToolGateway(), registry, {
      day: 1,
      phase: Phase.Voting,
      gameOver: false,
      result: null,
    }).resolve(
      result.removed,
      { [sheriffId]: [DeathCause.Exile] },
      {
        async getAction() {
          return null;
        },
      },
      Phase.Voting,
      Phase.Voting,
    );
    const transferred = events.find((event) => event.type === "sheriff_badge_transferred");
    expect(transferred).toBeDefined();
    const toId = Number(transferred.payload.toId);
    const nextBadge = world.getComponent<BadgeComponent>(toId, COMPONENT.Badge);
    const nextVoting = world.getComponent<VotingRightComponent>(toId, COMPONENT.VotingRight);
    expect(nextBadge?.isSheriff).toBe(true);
    expect(nextBadge?.destroyed).toBe(false);
    expect(nextVoting?.weight).toBe(1.5);
  });

  test("sheriff badge is destroyed when no valid transfer candidate", async () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const registry = new EventRegistry();

    const sheriffId = world
      .entityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role !== "idiot")!;
    const sheriffBadge = world.getComponent<BadgeComponent>(sheriffId, COMPONENT.Badge)!;
    sheriffBadge.isSheriff = true;
    sheriffBadge.destroyed = false;

    for (const id of world.entityIds()) {
      if (id === sheriffId) {
        continue;
      }
      const alive = world.getComponent<AliveComponent>(id, COMPONENT.Alive);
      if (alive) {
        alive.alive = false;
      }
      const voting = world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight);
      if (voting) {
        voting.canVote = false;
        voting.weight = 0;
      }
    }

    const result = registry.onVotedOut(world, sheriffId, events);
    await new DeathResolution(world, events, new ToolGateway(), registry, {
      day: 1,
      phase: Phase.Voting,
      gameOver: false,
      result: null,
    }).resolve(
      result.removed,
      { [sheriffId]: [DeathCause.Exile] },
      {
        async getAction() {
          return null;
        },
      },
      Phase.Voting,
      Phase.Voting,
    );
    const destroyed = events.find((event) => event.type === "sheriff_badge_destroyed");
    expect(destroyed).toBeDefined();

    const anySheriffLeft = world
      .entityIds()
      .some((id) => world.getComponent<BadgeComponent>(id, COMPONENT.Badge)?.isSheriff);
    expect(anySheriffLeft).toBe(false);
  });

  test("idiot sheriff reveal also triggers transfer or destroy", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const registry = new EventRegistry();

    const idiotId = world
      .entityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "idiot")!;
    const idiotBadge = world.getComponent<BadgeComponent>(idiotId, COMPONENT.Badge)!;
    idiotBadge.isSheriff = true;
    idiotBadge.destroyed = false;

    const result = registry.onVotedOut(world, idiotId, events);
    expect(result.prevented).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "sheriff_badge_transferred" || event.type === "sheriff_badge_destroyed",
      ),
    ).toBe(true);
  });
});
