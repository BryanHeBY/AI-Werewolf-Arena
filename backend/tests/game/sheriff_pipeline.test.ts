import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { AliveComponent } from "../../src/domain/components/alive";
import { BadgeComponent } from "../../src/domain/components/badge";
import { VotingRightComponent } from "../../src/domain/components/voting_right";
import { RoleComponent } from "../../src/domain/components/role";
import { ActionProvider, ActionRequest, ToolCall } from "../../src/domain/model";
import { EventRegistry } from "../../src/engine/event_registry";
import { DayPipeline } from "../../src/engine/phase_pipeline/day_pipeline";
import { RoleRegistry } from "../../src/domain/registries/role_registry";
import { ToolGateway } from "../../src/gateway/tool_gateway";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

describe("sheriff pipeline", () => {
  test("no initial sheriff before election", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const sheriffId = world
      .entityIds()
      .find((id) => world.getComponent<BadgeComponent>(id, COMPONENT.Badge)?.isSheriff);

    expect(sheriffId).toBeUndefined();
  });

  test("sheriff voted out triggers badge transfer to next alive voter", () => {
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

  test("day pipeline elects sheriff on day 1", async () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [{ timestamp: Date.now(), type: "phase_changed", payload: { phase: "day", day: 1 } }];
    const pipeline = new DayPipeline(world, new RoleRegistry(), new ToolGateway(), events);
    const voteStageFeeds: string[][] = [];
    const sheriffVoteActors: number[] = [];

    const actionProvider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.allowedTools.includes("run_for_sheriff")) {
          return {
            name: "run_for_sheriff",
            args: { run: request.actorId === 2 || request.actorId === 3 },
          };
        }
        if (request.allowedTools.includes("vote_for_sheriff")) {
          const feed = Array.isArray(request.context.broadcast_feed)
            ? request.context.broadcast_feed.map((line) => String(line))
            : [];
          sheriffVoteActors.push(request.actorId);
          voteStageFeeds.push(feed);
          return { name: "vote_for_sheriff", args: { target_id: 2, abstain: false } };
        }
        if (request.allowedTools.includes("choose_direction")) {
          return { name: "choose_direction", args: { direction: "clockwise" } };
        }
        if (request.allowedTools.includes("self_destruct")) {
          return null;
        }
        if (request.allowedTools.includes("speak")) {
          return { name: "speak", args: { text: "ok" } };
        }
        return null;
      },
    };

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider);
    expect(result.interrupted).toBe(false);
    const elected = events.find((event) => event.type === "sheriff_elected");
    expect(elected).toBeDefined();
    expect(Number(elected.payload.winnerId)).toBe(2);
    expect(voteStageFeeds.length).toBeGreaterThan(0);
    expect(sheriffVoteActors).not.toContain(2);
    expect(sheriffVoteActors).not.toContain(3);
    for (const feed of voteStageFeeds) {
      expect(feed.some((line) => line.includes("[警长投票]"))).toBe(false);
    }
  });
});
