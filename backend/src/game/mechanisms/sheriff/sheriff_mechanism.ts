/** 文件说明：警长机制主流程（上警、投警、发言顺序）。 */
import { AliveComponent } from "../../../core/domain/components/alive";
import { BadgeComponent } from "../../../core/domain/components/badge";
import { COMPONENT } from "../../../core/domain/components/names";
import { VotingRightComponent } from "../../../core/domain/components/voting_right";
import { IdentityComponent } from "../../../core/domain/entities/player";
import {
  ActionProvider,
  BoardConfig,
  EntityId,
  GameEvent,
  Phase,
  TieBreakerStrategy,
} from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { ToolGateway } from "../../gateway/tool_gateway";
import { GameActionRequestFactory } from "../../engine/action_request_factory";
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

    this.assignSheriffById(world, sheriffId, config);
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
    config?: BoardConfig;
  }): Promise<EntityId | null> {
    const { world, events, toolGateway, actionProvider, day, enableSheriff, config } = input;
    if (!enableSheriff || day !== 1) {
      return this.findSheriffId(world);
    }
    if (this.findSheriffId(world) !== null) {
      return this.findSheriffId(world);
    }

    const aliveIds = world.getAliveEntityIds();
    const candidates: EntityId[] = [];
    const requests = new GameActionRequestFactory(world, events, day);
    // 上警声明并行收集，避免顺序执行导致后手玩家读取前手“上警/退水”结果后被动调整。
    // 先建立全部请求，确保每位玩家读取同一批事件快照，再启动并行 Agent 调用。
    const nominationRequests = aliveIds.map((actorId) => ({
      actorId,
      request: requests.create({
        phase: Phase.Day,
        actorId,
        allowedTools: ["run_for_sheriff"],
        stage: "sheriff_nomination",
        requiresAction: true,
        summary: "上警声明阶段必须选择上警或退警。",
        context: {},
      }),
    }));
    const nominationResults = await Promise.all(
      nominationRequests.map(async ({ actorId, request }) => {
        const action = await actionProvider.getAction(request);
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

    const initialCandidates =
      candidates.length > 0 ? this.sortBySeat(world, candidates) : this.sortBySeat(world, [...aliveIds]);
    events.push({
      timestamp: Date.now(),
      type: "sheriff_nomination_summary",
      payload: { candidates: initialCandidates },
    });

    const candidateSet = new Set<EntityId>(initialCandidates);
    const campaignOrder = this.sortBySeat(world, [...candidateSet]);
    // 上警发言：候选人按座位顺序发言。
    for (const candidateId of campaignOrder) {
      if (!candidateSet.has(candidateId)) {
        continue;
      }
      const speechReq = requests.create({
        phase: Phase.Day,
        actorId: candidateId,
        allowedTools: ["speak"],
        stage: "sheriff_campaign_speech",
        requiresAction: true,
        summary: "警上竞选发言阶段必须完成一次发言。",
        context: {
          sheriff_candidates: [...candidateSet],
        },
      });
      const speechAction = await actionProvider.getAction(speechReq);
      if (speechAction?.name === "speak") {
        const speechResult = toolGateway.validateAndSanitize(world, candidateId, speechAction, {
          phase: Phase.Day,
        });
        if (speechResult.ok && speechResult.sanitizedCall) {
          events.push({
            timestamp: Date.now(),
            type: "day_speech",
            payload: {
              actorId: candidateId,
              text: speechResult.sanitizedCall.args.text,
            },
          });
        }
      }
    }

    // 发言结束后统一进入退水阶段，再进入警长投票。
    const orderedCandidates = this.sortBySeat(world, [...candidateSet]);
    const withdrawRequests = orderedCandidates.map((candidateId) => ({
      candidateId,
      request: requests.create({
        phase: Phase.Day,
        actorId: candidateId,
        allowedTools: ["run_for_sheriff"],
        stage: "sheriff_withdraw",
        requiresAction: true,
        summary: "退水阶段必须明确是否继续竞选。",
        context: {
          sheriff_candidates: [...candidateSet],
        },
      }),
    }));
    const withdrawResults = await Promise.all(
      withdrawRequests.map(async ({ candidateId, request }) => {
        const withdrawAction = await actionProvider.getAction(request);
        if (withdrawAction?.name !== "run_for_sheriff") {
          return null;
        }
        const withdrawResult = toolGateway.validateAndSanitize(world, candidateId, withdrawAction, {
          phase: Phase.Day,
        });
        if (!withdrawResult.ok || !withdrawResult.sanitizedCall) {
          return null;
        }
        return {
          candidateId,
          keepRunning: withdrawResult.sanitizedCall.args.run === true,
        };
      }),
    );
    const withdrawn: EntityId[] = [];
    for (const item of withdrawResults) {
      if (!item || item.keepRunning) {
        continue;
      }
      candidateSet.delete(item.candidateId);
      withdrawn.push(item.candidateId);
      events.push({
        timestamp: Date.now(),
        type: "sheriff_candidate_declared",
        payload: { actorId: item.candidateId, run: false },
      });
    }
    events.push({
      timestamp: Date.now(),
      type: "sheriff_withdraw_summary",
      payload: { withdrawn: this.sortBySeat(world, withdrawn) },
    });

    if (candidateSet.size === 0) {
      for (const id of initialCandidates) {
        candidateSet.add(id);
      }
    }
    const finalizedCandidates = this.sortBySeat(world, [...candidateSet]);
    events.push({
      timestamp: Date.now(),
      type: "sheriff_candidates_finalized",
      payload: { candidates: finalizedCandidates },
    });

    const tally = new Map<EntityId, number>();
    for (const id of finalizedCandidates) {
      tally.set(id, 0);
    }

    // 规则：警长投票仅允许警下玩家（未在最终警上名单内）参与。
    const sheriffVoterIds = aliveIds.filter((id) => !candidateSet.has(id));
    // 警长投票同样并行收集，所有投票基于同一快照上下文。
    const sheriffVoteRequests = sheriffVoterIds.map((actorId) => ({
      actorId,
      request: requests.create({
        phase: Phase.Day,
        actorId,
        allowedTools: ["vote_for_sheriff"],
        stage: "sheriff_vote",
        requiresAction: true,
        summary: "警长投票阶段必须完成一次投票（可弃票）。",
        context: {
          sheriff_candidates: finalizedCandidates,
        },
      }),
    }));
    const sheriffVoteResults = await Promise.all(
      sheriffVoteRequests.map(async ({ actorId, request }) => {
        const action = await actionProvider.getAction(request);
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

    const winner = this.pickSheriffWinner(
      world,
      finalizedCandidates,
      tally,
      config?.tieBreaker?.sheriffVote ?? "min_seat",
    );
    events.push({
      timestamp: Date.now(),
      type: "sheriff_vote_summary",
      payload: {
        votes: sheriffVoteResults.filter((item): item is { actorId: EntityId; targetId: EntityId | null; abstain: boolean } => item !== null),
        winnerId: winner,
      },
    });

    if (winner !== null) {
      this.assignSheriffById(world, winner, config);
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
    const defaultDirection: SpeakerDirection = "clockwise";
    if (!enableSheriff) {
      return defaultDirection;
    }

    const sheriffId = this.findSheriffId(world);
    if (sheriffId === null) {
      return defaultDirection;
    }

    let finalDirection: SpeakerDirection = defaultDirection;
    const requests = new GameActionRequestFactory(world, events, day);
    const req = requests.create({
      phase: Phase.Day,
      actorId: sheriffId,
      allowedTools: ["choose_direction"],
      stage: "sheriff_choose_direction",
      requiresAction: true,
      summary: "警长定序阶段必须选择发言方向。",
      context: {
      },
    });
    const action = await actionProvider.getAction(req);
    if (action?.name === "choose_direction") {
      const result = toolGateway.validateAndSanitize(world, sheriffId, action, {
        phase: Phase.Day,
      });
      if (result.ok && result.sanitizedCall) {
        finalDirection = result.sanitizedCall.args.direction;
      }
    }

    events.push({
      timestamp: Date.now(),
      type: "sheriff_direction_chosen",
      payload: {
        sheriffId,
        direction: finalDirection,
      },
    });

    return finalDirection;
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

  private assignSheriffById(
    world: World,
    sheriffId: EntityId,
    config?: BoardConfig,
  ): void {
    const sheriffWeight = config?.sheriff?.voteWeight ?? SheriffMechanism.SHERIFF_VOTE_WEIGHT;
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
        voting.weight = id === sheriffId ? sheriffWeight : 1;
      }
    }
  }

  private pickSheriffWinner(
    world: World,
    candidates: EntityId[],
    tally: Map<EntityId, number>,
    strategy: TieBreakerStrategy,
  ): EntityId | null {
    if (candidates.length === 0) {
      return null;
    }
    const withSeat = candidates.map((id) => {
      const identity = world.getComponent<IdentityComponent>(id, COMPONENT.Identity);
      return { id, seat: identity?.seat ?? id, score: tally.get(id) ?? 0 };
    });
    withSeat.sort((a, b) => {
      const diff = b.score - a.score;
      if (diff !== 0) {
        return diff;
      }
      if (strategy === "min_id") {
        return a.id - b.id;
      }
      return a.seat - b.seat;
    });
    if (withSeat.length >= 2 && withSeat[0].score === withSeat[1].score) {
      if (strategy === "no_elimination" || strategy === "no_kill") {
        return null;
      }
    }
    return withSeat[0]?.id ?? null;
  }

  private sortBySeat(world: World, ids: EntityId[]): EntityId[] {
    return [...ids].sort((a, b) => {
      const aSeat = world.getComponent<IdentityComponent>(a, COMPONENT.Identity)?.seat ?? a;
      const bSeat = world.getComponent<IdentityComponent>(b, COMPONENT.Identity)?.seat ?? b;
      return aSeat - bSeat;
    });
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
