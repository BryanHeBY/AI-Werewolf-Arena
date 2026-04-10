import { AliveComponent } from "../../domain/components/alive";
import { BadgeComponent } from "../../domain/components/badge";
import { COMPONENT } from "../../domain/components/names";
import { VotingRightComponent } from "../../domain/components/voting_right";
import { IdentityComponent } from "../../domain/entities/player";
import {
  ActionProvider,
  ActionRequest,
  BoardConfig,
  EntityId,
  GameEvent,
  Phase,
} from "../../domain/model";
import { World } from "../../domain/world";
import { ToolGateway } from "../../gateway/tool_gateway";
import { buildAgentBroadcastFeed } from "../../engine/agent_broadcast_feed";
import { transferOrDestroySheriffBadge } from "./sheriff_badge";

export type SpeakerDirection = "clockwise" | "counter_clockwise";

export class SheriffMechanism {
  assignInitialSheriff(world: World, config: BoardConfig, playerIds: EntityId[]): void {
    if (!config.enableSheriff || config.initialSheriffSeat === undefined) {
      return;
    }

    const sheriffId = playerIds.find((id) => {
      const identity = world.getComponent<{ seat: number }>(id, COMPONENT.Identity);
      return identity?.seat === config.initialSheriffSeat;
    });
    if (!sheriffId) {
      return;
    }

    const badge = world.getComponent<{ isSheriff: boolean; destroyed: boolean }>(
      sheriffId,
      COMPONENT.Badge,
    );
    if (badge) {
      badge.isSheriff = true;
      badge.destroyed = false;
    }

    const voting = world.getComponent<{ weight: number; canVote: boolean }>(
      sheriffId,
      COMPONENT.VotingRight,
    );
    if (voting && voting.canVote) {
      voting.weight = 1.5;
    }
  }

  findSheriffId(world: World): EntityId | null {
    const sheriff = world.getAliveEntityIds().find((id) => {
      const badge = world.getComponent<BadgeComponent>(id, COMPONENT.Badge);
      return badge?.isSheriff === true && badge.destroyed === false;
    });
    return sheriff ?? null;
  }

  async chooseSpeakerDirection(input: {
    world: World;
    events: GameEvent[];
    toolGateway: ToolGateway;
    actionProvider: ActionProvider;
    day: number;
    enableSheriff: boolean;
  }): Promise<SpeakerDirection> {
    const { world, events, toolGateway, actionProvider, day, enableSheriff } = input;
    if (!enableSheriff) {
      return "clockwise";
    }

    const sheriffId = this.findSheriffId(world);
    if (sheriffId === null) {
      return "clockwise";
    }

    const req: ActionRequest = {
      phase: Phase.Day,
      actorId: sheriffId,
      allowedTools: ["choose_direction"],
      context: {
        day,
        phase: "sheriff_choose_direction",
        must_act: true,
        broadcast_feed: buildAgentBroadcastFeed(world, events, sheriffId),
      },
    };
    const action = await actionProvider.getAction(req);
    if (action?.name !== "choose_direction") {
      return "clockwise";
    }

    const result = toolGateway.validateAndSanitize(world, sheriffId, action, {
      phase: Phase.Day,
    });
    if (!result.ok || !result.sanitizedCall) {
      return "clockwise";
    }

    events.push({
      timestamp: Date.now(),
      type: "sheriff_direction_chosen",
      payload: {
        sheriffId,
        direction: result.sanitizedCall.args.direction,
      },
    });

    return result.sanitizedCall.args.direction;
  }

  buildSpeakerOrder(
    world: World,
    aliveIds: EntityId[],
    sheriffId: EntityId | null,
    direction: SpeakerDirection,
  ): EntityId[] {
    if (sheriffId === null) {
      return [...aliveIds];
    }

    const seatMap = new Map<EntityId, number>();
    for (const id of aliveIds) {
      const identity = world.getComponent<IdentityComponent>(id, COMPONENT.Identity);
      seatMap.set(id, identity?.seat ?? id);
    }

    const orderedBySeat = [...aliveIds].sort(
      (a, b) => (seatMap.get(a) ?? a) - (seatMap.get(b) ?? b),
    );
    const sheriffIndex = orderedBySeat.indexOf(sheriffId);
    if (sheriffIndex < 0) {
      return orderedBySeat;
    }

    if (direction === "clockwise") {
      return [
        ...orderedBySeat.slice(sheriffIndex + 1),
        ...orderedBySeat.slice(0, sheriffIndex + 1),
      ];
    }

    const counterClockwise: EntityId[] = [];
    for (let i = sheriffIndex - 1; i >= 0; i--) {
      counterClockwise.push(orderedBySeat[i]);
    }
    for (let i = orderedBySeat.length - 1; i > sheriffIndex; i--) {
      counterClockwise.push(orderedBySeat[i]);
    }
    counterClockwise.push(sheriffId);
    return counterClockwise;
  }

  handleSheriffDeath(
    world: World,
    entityId: EntityId,
    phase: Phase,
    events: GameEvent[],
  ): void {
    const badge = world.getComponent<BadgeComponent>(entityId, COMPONENT.Badge);
    if (!badge?.isSheriff) {
      return;
    }
    transferOrDestroySheriffBadge(world, entityId, `${phase}_death`, events);
  }
}

let defaultMechanism: SheriffMechanism | null = null;

export function getDefaultSheriffMechanism(): SheriffMechanism {
  if (!defaultMechanism) {
    defaultMechanism = new SheriffMechanism();
  }
  return defaultMechanism;
}
