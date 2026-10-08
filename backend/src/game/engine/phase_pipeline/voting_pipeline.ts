import { COMPONENT } from "../../../core/domain/components/names";
import { IdentityComponent } from "../../../core/domain/entities/player";
import { VotingRightComponent } from "../../../core/domain/components/voting_right";
import {
  ActionProvider,
  ActionWindow,
  BoardConfig,
  EntityId,
  GameEvent,
  Phase,
  TieBreakerStrategy,
  VoteRecord,
  VotingSummary,
} from "../../../core/domain/model";
import { RoleRegistry } from "../../../core/domain/registries/role_registry";
import { ToolGateway } from "../../gateway/tool_gateway";
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import { EventRegistry } from "../event_registry";
import { World } from "../../../core/domain/world";
import { GameActionRequestFactory } from "../action_request_factory";
import { SelfDestructWindow, isSelfDestructWindowEnabled } from "../self_destruct_window";

/**
 * 投票流水线执行结果。
 */
export interface VotingPipelineResult {
  summary: VotingSummary;
  interrupted: boolean;
  removed: EntityId[];
}

export interface VotingPipelineOptions {
  /** 当前日次由 PhaseManager 显式传入，不能从事件历史反推。 */
  day: number;
}

export interface VotingPipelineDependencies {
  world: World;
  roleRegistry: RoleRegistry;
  toolGateway: ToolGateway;
  eventRegistry: EventRegistry;
  events: GameEvent[];
}

interface CollectedVote {
  voterId: EntityId;
  targetId: EntityId | null;
  abstain: boolean;
  fallback: boolean;
}

/**
 * 放逐投票流水线：
 * 1) 在 onPreVote 窗口可触发狼人自爆中断。
 * 2) 存活且有投票权玩家依次投票，按权重计票。
 * 3) 调用 EventRegistry 处理白痴免死、警徽销毁等投后钩子。
 */
export class VotingPipeline {
  private static readonly MAX_VOTE_RETRIES = 3;
  private readonly world: World;
  private readonly selfDestructWindow: SelfDestructWindow;
  private readonly toolGateway: ToolGateway;
  private readonly eventRegistry: EventRegistry;
  private readonly events: GameEvent[];

  constructor(dependencies: VotingPipelineDependencies) {
    this.world = dependencies.world;
    this.toolGateway = dependencies.toolGateway;
    this.eventRegistry = dependencies.eventRegistry;
    this.events = dependencies.events;
    this.selfDestructWindow = new SelfDestructWindow(this.world, dependencies.roleRegistry, this.toolGateway, this.events);
  }

  async execute(
    config: BoardConfig,
    actionProvider: ActionProvider,
    options: VotingPipelineOptions,
  ): Promise<VotingPipelineResult> {
    const requests = new GameActionRequestFactory(
      this.world,
      this.events,
      options.day,
    );
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "voting_pipeline_start",
      phase: Phase.Voting,
      status: "ok",
      input: {
        on_pre_vote_hook: config.hooks.onPreVote,
      },
    });
    if (
      config.hooks.onPreVote &&
      isSelfDestructWindowEnabled(config, ActionWindow.OnPreVote)
    ) {
      const exploded = await this.selfDestructWindow.execute(requests, actionProvider, ActionWindow.OnPreVote, Phase.Voting);
      if (exploded !== null) {
        safeRecordLogicOp({
          scope: "phase_pipeline",
          op: "voting_interrupted_by_self_destruct",
          actorId: exploded,
          phase: Phase.Voting,
          status: "ok",
        });
        return {
          summary: {
            tally: {},
            target: null,
            removed: [exploded],
          },
          interrupted: true,
          removed: [exploded],
        };
      }
    }

    const voters = this.world.getAliveEntityIds().filter((id) => {
      const voting = this.world.getComponent<VotingRightComponent>(
        id,
        COMPONENT.VotingRight,
      );
      return voting?.canVote === true;
    });

    // Requests run in parallel; Promise.all retains voter order for deterministic replay events.
    const voteResults = await Promise.all(
      voters.map((voterId) => this.collectVoterVote(voterId, requests, actionProvider)),
    );
    const { tally, publicVotes } = this.recordVotesInSeatOrder(voteResults);

    const target = this.pickMajorityTarget(
      tally,
      config.tieBreaker?.exileVote ?? "min_id",
    );
    this.events.push({
      timestamp: Date.now(),
      type: "vote_summary",
      payload: {
        votes: publicVotes,
        tally,
        target,
      },
    });
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "vote_tally_resolved",
      phase: Phase.Voting,
      status: "ok",
      output: {
        tally,
        target,
      },
    });
    if (target === null) {
      return {
        summary: {
          tally,
          target: null,
          removed: [],
        },
        interrupted: false,
        removed: [],
      };
    }

    const votedOut = this.eventRegistry.onVotedOut(this.world, target, this.events);
    const removed = [...votedOut.removed];

    if (removed.includes(target)) {
      // 只有真正出局才广播 voted_out；白痴翻牌由事件总线单独广播。
      this.events.push({
        timestamp: Date.now(),
        type: "voted_out",
        payload: {
          target,
        },
      });
    }

    return {
      summary: {
        tally,
        target,
        removed,
      },
      interrupted: false,
      removed,
    };
  }

  private async collectVoterVote(
    voterId: EntityId,
    requests: GameActionRequestFactory,
    actionProvider: ActionProvider,
  ): Promise<CollectedVote | null> {
    const maxRetries = VotingPipeline.MAX_VOTE_RETRIES;
    let retryReason = "";
    const recordRetry = (attempt: number) => safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "vote_retry_requested",
      actorId: voterId,
      phase: Phase.Voting,
      status: "fallback",
      reason: retryReason,
      output: { attempt, max_retries: maxRetries },
    });

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const baseRequest = requests.create({
        phase: Phase.Voting,
        actorId: voterId,
        allowedTools: ["vote"],
        stage: "voting",
        requiresAction: true,
        summary: { key: "request.summary.exile_vote" },
      });
      const request = attempt === 1 ? baseRequest : {
        ...baseRequest,
        context: {
          ...baseRequest.context,
          retry_attempt: attempt - 1,
          retry_max: maxRetries,
          retry_reason: retryReason,
          retry_notice_message: { key: "request.retry.exile_vote" as const },
        },
      };
      const action = await actionProvider.getAction(request);
      if (action?.name !== "vote") {
        retryReason = "no_valid_vote_tool_call";
        if (attempt <= maxRetries) {
          recordRetry(attempt);
          continue;
        }
        break;
      }

      const result = this.toolGateway.validateAndSanitize(
        this.world, voterId, action, { phase: Phase.Voting },
      );
      if (!result.ok || !result.sanitizedCall) {
        retryReason = "invalid_vote_arguments";
        if (attempt <= maxRetries) {
          recordRetry(attempt);
          continue;
        }
        break;
      }
      return {
        voterId,
        targetId: result.sanitizedCall.args.target_id,
        abstain: result.sanitizedCall.args.abstain === true,
        fallback: attempt > 1,
      };
    }

    // Exhausted requests become an explicit abstention when the gateway accepts it.
    const repaired = this.toolGateway.validateAndSanitize(
      this.world,
      voterId,
      { name: "vote", args: { target_id: null, abstain: true } },
      { phase: Phase.Voting },
    );
    if (repaired.ok && repaired.sanitizedCall) {
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "vote_repaired_to_abstain",
        actorId: voterId,
        phase: Phase.Voting,
        status: "ok",
        reason: retryReason || "vote_retry_exhausted",
      });
      return { voterId, targetId: null, abstain: true, fallback: true };
    }
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "vote_rejected",
      actorId: voterId,
      phase: Phase.Voting,
      status: "rejected",
      reason: retryReason || "vote_retry_exhausted",
    });
    return null;
  }

  private recordVotesInSeatOrder(votes: Array<CollectedVote | null>): {
    tally: Record<number, number>;
    publicVotes: VoteRecord[];
  } {
    const tally: Record<number, number> = {};
    const publicVotes: VoteRecord[] = [];
    for (const vote of votes) {
      if (!vote) continue;
      const { voterId } = vote;
      let weight = 0;
      if (!vote.abstain && vote.targetId !== null) {
        const voting = this.world.getComponent<VotingRightComponent>(voterId, COMPONENT.VotingRight);
        weight = voting?.weight ?? 1;
        tally[vote.targetId] = (tally[vote.targetId] ?? 0) + weight;
      }
      this.events.push({
        timestamp: Date.now(),
        type: "vote_cast",
        payload: {
          actorId: voterId,
          targetId: vote.targetId,
          abstain: vote.abstain,
          weight,
          ...(vote.fallback ? { fallback: true } : {}),
        },
      });
      publicVotes.push({ actorId: voterId, targetId: vote.targetId, abstain: vote.abstain, weight });
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "vote_cast",
        actorId: voterId,
        phase: Phase.Voting,
        status: "ok",
        output: { target_id: vote.targetId, abstain: vote.abstain, weight },
      });
    }
    return { tally, publicVotes };
  }

  /**
   * 依据计票结果选出放逐目标，平票按编号最小值决议。
   */
  private pickMajorityTarget(
    tally: Record<number, number>,
    strategy: TieBreakerStrategy,
  ): EntityId | null {
    const entries = Object.entries(tally);
    if (entries.length === 0) {
      return null;
    }

    entries.sort((a, b) => {
      const voteDiff = b[1] - a[1];
      if (voteDiff !== 0) {
        return voteDiff;
      }
      if (strategy === "min_seat") {
        const aId = Number(a[0]);
        const bId = Number(b[0]);
        const aSeat =
          this.world.getComponent<IdentityComponent>(aId, COMPONENT.Identity)?.seat ??
          aId;
        const bSeat =
          this.world.getComponent<IdentityComponent>(bId, COMPONENT.Identity)?.seat ??
          bId;
        return aSeat - bSeat;
      }
      return Number(a[0]) - Number(b[0]);
    });

    if (entries.length >= 2 && entries[0][1] === entries[1][1]) {
      if (strategy === "no_elimination") {
        return null;
      }
    }

    return Number(entries[0][0]);
  }
}
