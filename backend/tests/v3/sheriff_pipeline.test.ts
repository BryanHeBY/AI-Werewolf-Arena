import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { AliveComponent } from "../../src/domain/components/alive";
import { BadgeComponent } from "../../src/domain/components/badge";
import { VotingRightComponent } from "../../src/domain/components/voting_right";
import { RoleComponent } from "../../src/domain/components/role";
import { EventRegistry } from "../../src/engine/event_registry";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

describe("sheriff pipeline", () => {
  test("initial sheriff has 1.5 vote weight", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const sheriffId = world
      .entityIds()
      .find((id) => world.getComponent<BadgeComponent>(id, COMPONENT.Badge)?.isSheriff);

    expect(sheriffId).toBeDefined();
    const voting = world.getComponent<VotingRightComponent>(
      sheriffId!,
      COMPONENT.VotingRight,
    );
    expect(voting?.weight).toBe(1.5);
  });

  test("sheriff voted out triggers badge transfer to next alive voter", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const registry = new EventRegistry();

    const sheriffId = world
      .entityIds()
      .find((id) => world.getComponent<BadgeComponent>(id, COMPONENT.Badge)?.isSheriff)!;

    const result = registry.onVotedOut(world, sheriffId, events);
    expect(result.prevented).toBe(false);
    expect(result.removed).toEqual([sheriffId]);

    const transferred = events.find((event) => event.type === "sheriff_badge_transferred");
    expect(transferred).toBeDefined();
    const toId = Number(transferred.payload.toId);
    const nextBadge = world.getComponent<BadgeComponent>(toId, COMPONENT.Badge);
    const nextVoting = world.getComponent<VotingRightComponent>(
      toId,
      COMPONENT.VotingRight,
    );
    expect(nextBadge?.isSheriff).toBe(true);
    expect(nextBadge?.destroyed).toBe(false);
    expect(nextVoting?.weight).toBe(1.5);
  });

  test("sheriff badge is destroyed when no valid transfer candidate", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const registry = new EventRegistry();

    const sheriffId = world
      .entityIds()
      .find((id) => world.getComponent<BadgeComponent>(id, COMPONENT.Badge)?.isSheriff)!;

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

    registry.onVotedOut(world, sheriffId, events);
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
          event.type === "sheriff_badge_transferred" ||
          event.type === "sheriff_badge_destroyed",
      ),
    ).toBe(true);
  });
});

