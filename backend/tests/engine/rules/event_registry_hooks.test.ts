import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { AliveComponent } from "../../../src/core/domain/components/alive";
import { RoleComponent } from "../../../src/core/domain/components/role";
import { Role, DeathCause, Phase } from "../../../src/core/domain/model";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";

describe("EventRegistry hooks", () => {
  test("idiot voted out survives and loses voting right", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const eventRegistry = new EventRegistry();

    const idiotId = world
      .getAliveEntityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Idiot);

    expect(idiotId).toBeDefined();

    const result = eventRegistry.onVotedOut(world, idiotId!, events);
    const alive = world.getComponent<AliveComponent>(idiotId!, COMPONENT.Alive)!;
    const voting = world.getComponent<any>(idiotId!, COMPONENT.VotingRight)!;

    expect(result.prevented).toBe(true);
    expect(alive.alive).toBe(true);
    expect(voting.canVote).toBe(false);
    expect(voting.weight).toBe(0);
  });

  test("hunter poisoned cannot shoot", async () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const eventRegistry = new EventRegistry();

    const hunterId = world
      .getAliveEntityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Hunter)!;
    const targetId = world.getAliveEntityIds().find((id) => id !== hunterId)!;

    const hunterAlive = world.getComponent<AliveComponent>(hunterId, COMPONENT.Alive)!;
    hunterAlive.alive = false;

    const result = await eventRegistry.onDeath(
      world,
      [hunterId],
      { [hunterId]: [DeathCause.Poison] },
      async () => ({ kind: "invalid" as const }),
      events,
    );

    const targetAlive = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive)!;

    expect(result.extraDeaths).toHaveLength(0);
    expect(targetAlive.alive).toBe(true);
  });

  test("hunter normal death returns a sourced proposal without owning Alive", async () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const eventRegistry = new EventRegistry();

    const hunterId = world
      .getAliveEntityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Hunter)!;
    const targetId = world.getAliveEntityIds().find((id) => id !== hunterId)!;

    const hunterAlive = world.getComponent<AliveComponent>(hunterId, COMPONENT.Alive)!;
    hunterAlive.alive = false;

    const permit = world.openDeathAction(hunterId, "shoot", Phase.Day, 1);
    const result = await eventRegistry.onDeath(
      world,
      [hunterId],
      { [hunterId]: [DeathCause.Exile] },
      async () => ({ kind: "shot" as const, targetId, deathActionId: permit.id }),
      events,
    );

    permit.close();
    const targetAlive = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive)!;

    expect(result.extraDeaths).toContain(targetId);
    expect(targetAlive.alive).toBe(true);
  });
});
