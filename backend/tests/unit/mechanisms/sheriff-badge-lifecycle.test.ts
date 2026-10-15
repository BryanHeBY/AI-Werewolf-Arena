/**
 * 单元测试：验证警长初始配置及有限投票／死亡警徽生命周期。输入为原局部 World、警徽／票权／生命修改和直接 DeathResolution 操作；竞选、转移／销毁与白痴翻牌为原字面预期，不运行完整白天 pipeline 或模型。
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import { AliveComponent } from "../../../src/domain/components/alive";
import { BadgeComponent } from "../../../src/domain/components/badge";
import { VotingRightComponent } from "../../../src/domain/components/voting-right";
import { RoleComponent } from "../../../src/domain/components/role";
import { DeathCause, Phase } from "../../../src/domain/model";
import { DeathResolution } from "../../../src/engine/death-resolution";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { twelvePlayerStandardConfig } from "../../../src/rulesets/presets/twelve-player-standard";

describe("sheriff pipeline", () => {
  test("no initial sheriff before election", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const sheriffId = world
      .entityIds()
      .find((id) => world.getComponent(id, COMPONENT.Badge)?.isSheriff);

    expect(sheriffId).toBeUndefined();
  });

  test("initial sheriff assignment emits a canonical replay election event", () => {
    const config = { ...twelvePlayerStandardConfig, initialSheriffSeat: 1 };
    const context = bootstrapGame(config);
    const sheriffId = context.playerIds.find(
      (id) => context.world.getComponent(id, COMPONENT.Identity)?.seat === 1,
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
      .find((id) => world.getComponent(id, COMPONENT.Role)?.role !== "idiot")!;
    const sheriffBadge = world.getComponent(sheriffId, COMPONENT.Badge)!;
    sheriffBadge.isSheriff = true;
    sheriffBadge.destroyed = false;
    const sheriffVoting = world.getComponent(
      sheriffId,
      COMPONENT.VotingRight,
    )!;
    sheriffVoting.weight = 1.5;

    const result = registry.onVotedOut(world, sheriffId, events);
    expect(result.prevented).toBe(false);
    expect(result.removed).toEqual([sheriffId]);

    expect(world.getComponent(sheriffId, COMPONENT.Alive)!.alive).toBe(true);
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
    const nextBadge = world.getComponent(toId, COMPONENT.Badge);
    const nextVoting = world.getComponent(toId, COMPONENT.VotingRight);
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
      .find((id) => world.getComponent(id, COMPONENT.Role)?.role !== "idiot")!;
    const sheriffBadge = world.getComponent(sheriffId, COMPONENT.Badge)!;
    sheriffBadge.isSheriff = true;
    sheriffBadge.destroyed = false;

    for (const id of world.entityIds()) {
      if (id === sheriffId) {
        continue;
      }
      const alive = world.getComponent(id, COMPONENT.Alive);
      if (alive) {
        alive.alive = false;
      }
      const voting = world.getComponent(id, COMPONENT.VotingRight);
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
      .some((id) => world.getComponent(id, COMPONENT.Badge)?.isSheriff);
    expect(anySheriffLeft).toBe(false);
  });

  test("idiot sheriff reveal also triggers transfer or destroy", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const registry = new EventRegistry();

    const idiotId = world
      .entityIds()
      .find((id) => world.getComponent(id, COMPONENT.Role)?.role === "idiot")!;
    const idiotBadge = world.getComponent(idiotId, COMPONENT.Badge)!;
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
