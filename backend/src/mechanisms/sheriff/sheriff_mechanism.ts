/** 文件说明：警长机制主流程（上警、投警、发言顺序）。 */
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

/** 警长发言方向。 */
export type SpeakerDirection = "clockwise" | "counter_clockwise";

/** 警长机制实现。 */
export class SheriffMechanism {
  private static readonly SHERIFF_VOTE_WEIGHT = 1.5;

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

    this.assignSheriffById(world, sheriffId);
  }

  findSheriffId(world: World): EntityId | null {
    const sheriff = world.getAliveEntityIds().find((id) => {
      const badge = world.getComponent<BadgeComponent>(id, COMPONENT.Badge);
      return badge?.isSheriff === true && badge.destroyed === false;
    });
    return sheriff ?? null;
  }

  async electSheriffIfNeeded(input: {
    world: World;
    events: GameEvent[];
    toolGateway: ToolGateway;
    actionProvider: ActionProvider;
    day: number;
    enableSheriff: boolean;
  }): Promise<EntityId | null> {
    const { world, events, toolGateway, actionProvider, day, enableSheriff } = input;
    if (!enableSheriff || day !== 1) {
      return this.findSheriffId(world);
    }
    if (this.findSheriffId(world) !== null) {
      return this.findSheriffId(world);
    }

    const aliveIds = world.getAliveEntityIds();
    const candidates: EntityId[] = [];
    const nominationFeedByActor = new Map<EntityId, string[]>();
    for (const actorId of aliveIds) {
      nominationFeedByActor.set(
        actorId,
        buildAgentBroadcastFeed(world, events, actorId),
      );
    }
    // 上警声明并行收集，避免顺序执行导致后手玩家读取前手“上警/退水”结果后被动调整。
    const nominationResults = await Promise.all(
      aliveIds.map(async (actorId) => {
        const req: ActionRequest = {
          phase: Phase.Day,
          actorId,
          allowedTools: ["run_for_sheriff"],
          context: {
            day,
            phase: "sheriff_nomination",
            must_act: true,
            broadcast_feed: nominationFeedByActor.get(actorId) ?? [],
          },
        };
        const action = await actionProvider.getAction(req);
        if (action?.name !== "run_for_sheriff") {
          return null;
        }
        const result = toolGateway.validateAndSanitize(world, actorId, action, {
          phase: Phase.Day,
        });
        if (!result.ok || !result.sanitizedCall) {
          return null;
        }
        return {
          actorId,
          run: result.sanitizedCall.args.run === true,
        };
      }),
    );
    for (const item of nominationResults) {
      if (!item) {
        continue;
      }
      events.push({
        timestamp: Date.now(),
        type: "sheriff_candidate_declared",
        payload: { actorId: item.actorId, run: item.run },
      });
      if (item.run) {
        candidates.push(item.actorId);
      }
    }

    const finalizedCandidates = candidates.length > 0 ? candidates : [...aliveIds];
    events.push({
      timestamp: Date.now(),
      type: "sheriff_candidates_finalized",
      payload: { candidates: finalizedCandidates },
    });

    const tally = new Map<EntityId, number>();
    for (const id of finalizedCandidates) {
      tally.set(id, 0);
    }

    const sheriffVoteFeedByActor = new Map<EntityId, string[]>();
    for (const actorId of aliveIds) {
      sheriffVoteFeedByActor.set(
        actorId,
        buildAgentBroadcastFeed(world, events, actorId),
      );
    }
    // 警长投票同样并行收集，所有投票基于同一快照上下文。
    const sheriffVoteResults = await Promise.all(
      aliveIds.map(async (actorId) => {
        const req: ActionRequest = {
          phase: Phase.Day,
          actorId,
          allowedTools: ["vote_for_sheriff"],
          context: {
            day,
            phase: "sheriff_vote",
            must_act: true,
            sheriff_candidates: finalizedCandidates,
            broadcast_feed: sheriffVoteFeedByActor.get(actorId) ?? [],
          },
        };
        const action = await actionProvider.getAction(req);
        if (action?.name !== "vote_for_sheriff") {
          return null;
        }
        const result = toolGateway.validateAndSanitize(world, actorId, action, {
          phase: Phase.Day,
        });
        if (!result.ok || !result.sanitizedCall) {
          return null;
        }

        const abstain = result.sanitizedCall.args.abstain === true;
        let targetId = result.sanitizedCall.args.target_id;
        if (!abstain && (targetId === null || !finalizedCandidates.includes(targetId))) {
          targetId = finalizedCandidates[0];
        }
        return { actorId, targetId, abstain };
      }),
    );
    for (const item of sheriffVoteResults) {
      if (!item) {
        continue;
      }
      events.push({
        timestamp: Date.now(),
        type: "sheriff_vote_cast",
        payload: {
          actorId: item.actorId,
          targetId: item.targetId,
          abstain: item.abstain,
        },
      });
      if (!item.abstain && item.targetId !== null) {
        tally.set(item.targetId, (tally.get(item.targetId) ?? 0) + 1);
      }
    }

    const winner = this.pickSheriffWinner(world, finalizedCandidates, tally);
    if (winner !== null) {
      this.assignSheriffById(world, winner);
      events.push({
        timestamp: Date.now(),
        type: "sheriff_elected",
        payload: {
          winnerId: winner,
          candidates: finalizedCandidates,
          tally: Object.fromEntries(tally.entries()),
        },
      });
    }
    return winner;
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

  private assignSheriffById(world: World, sheriffId: EntityId): void {
    for (const id of world.getAliveEntityIds()) {
      const badge = world.getComponent<{ isSheriff: boolean; destroyed: boolean }>(
        id,
        COMPONENT.Badge,
      );
      if (badge) {
        badge.isSheriff = id === sheriffId;
        badge.destroyed = false;
      }
      const voting = world.getComponent<{ weight: number; canVote: boolean }>(
        id,
        COMPONENT.VotingRight,
      );
      if (voting?.canVote) {
        voting.weight = id === sheriffId ? SheriffMechanism.SHERIFF_VOTE_WEIGHT : 1;
      }
    }
  }

  private pickSheriffWinner(
    world: World,
    candidates: EntityId[],
    tally: Map<EntityId, number>,
  ): EntityId | null {
    if (candidates.length === 0) {
      return null;
    }
    const withSeat = candidates.map((id) => {
      const identity = world.getComponent<IdentityComponent>(id, COMPONENT.Identity);
      return { id, seat: identity?.seat ?? id, score: tally.get(id) ?? 0 };
    });
    withSeat.sort((a, b) => b.score - a.score || a.seat - b.seat);
    return withSeat[0]?.id ?? null;
  }
}

let defaultMechanism: SheriffMechanism | null = null;

/** 获取默认警长机制实例。 */
export function getDefaultSheriffMechanism(): SheriffMechanism {
  if (!defaultMechanism) {
    defaultMechanism = new SheriffMechanism();
  }
  return defaultMechanism;
}
