import { resolveTricksterExile } from "../../mechanisms/roles/trickster/night_frame";
import { assertOrderPrinceOriginalCurrent } from "../../mechanisms/roles/order_prince/authority";
import { runOrderPrinceChoice } from "../../mechanisms/roles/order_prince/voting_window";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
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
  Role,
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
import { canBeExiled, canVoteExile } from "../../mechanisms/common/participation";

/**
 * 投票流水线执行结果。
 */
export interface VotingPipelineResult {
  summary: VotingSummary;
  interrupted: boolean;
  removed: EntityId[];
  selfDestruct?: import("../../../core").SelfDestructSelection;
}

export interface VotingPipelineOptions {
  strictRequired?: boolean;
  orderPrinceRevote?: boolean;
  /** 当前日次由 PhaseManager 显式传入，不能从事件历史反推。 */
  day: number;
  isCurrent?: () => boolean;
  commitSelfDestruct?: (
    choice: import("../../../core").SelfDestructSelection,
  ) => Promise<void | boolean>;
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
  voterLife: NonNullable<ReturnType<typeof captureNightLife>>;
  targetLife?: NonNullable<ReturnType<typeof captureNightLife>>;
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
    this.selfDestructWindow = new SelfDestructWindow(
      this.world,
      dependencies.roleRegistry,
      this.toolGateway,
    );
  }

  async execute(
    config: BoardConfig,
    actionProvider: ActionProvider,
    options: VotingPipelineOptions,
  ): Promise<VotingPipelineResult> {
    const requests = new GameActionRequestFactory(this.world, this.events, options.day);
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "voting_pipeline_start",
      phase: Phase.Voting,
      status: "ok",
      input: {
        on_pre_vote_hook: config.hooks.onPreVote,
      },
    });
    if (config.hooks.onPreVote && isSelfDestructWindowEnabled(config, ActionWindow.OnPreVote)) {
      const exploded = await this.selfDestructWindow.execute(
        requests,
        actionProvider,
        ActionWindow.OnPreVote,
        Phase.Voting,
        options.isCurrent,
        options.commitSelfDestruct,
      );
      if (exploded !== null) {
        safeRecordLogicOp({
          scope: "phase_pipeline",
          op: "voting_interrupted_by_self_destruct",
          actorId: exploded.actorId,
          phase: Phase.Voting,
          status: "ok",
        });
        return {
          summary: {
            tally: {},
            target: null,
            removed:
              exploded.targetId === null
                ? [exploded.actorId]
                : [exploded.actorId, exploded.targetId],
          },
          interrupted: true,
          selfDestruct: exploded,
          removed:
            exploded.targetId === null ? [exploded.actorId] : [exploded.actorId, exploded.targetId],
        };
      }
    }

    if (options.isCurrent && !options.isCurrent())
      return { summary: { tally: {}, target: null, removed: [] }, interrupted: false, removed: [] };
    const voters = this.world
      .getAliveEntityIds()
      .filter((id) => canVoteExile(this.world, id, options.day));

    // Requests run in parallel; Promise.all retains voter order for deterministic replay events.
    const voteResults = await this.collectVotes(voters, requests, actionProvider, options);
    if (options.isCurrent?.() === false)
      return { summary: { tally: {}, target: null, removed: [] }, interrupted: false, removed: [] };
    let { tally, publicVotes } = this.recordVotesInSeatOrder(voteResults, options.day);
    if (config.roleSetups.some((setup) => setup.role === Role.OrderPrince && setup.count > 0)) {
      const restarted = await runOrderPrinceChoice(
        this.world,
        requests,
        actionProvider,
        this.toolGateway,
        this.events,
        options.day,
        () => options.isCurrent?.() !== false,
      );
      if (restarted) {
        const previousCurrent = options.isCurrent;
        options = {
          ...options,
          strictRequired: true,
          orderPrinceRevote: true,
          isCurrent: () => {
            assertOrderPrinceOriginalCurrent(this.world);
            if (previousCurrent?.() === false) throw new Error("order_prince_revote_stale");
            return true;
          },
        };
        const freshVoters = this.world
          .getAliveEntityIds()
          .filter((id) => canVoteExile(this.world, id, options.day));
        const fresh = await this.collectVotes(freshVoters, requests, actionProvider, options);
        if (options.isCurrent?.() === false) throw new Error("order_prince_revote_stale");
        ({ tally, publicVotes } = this.recordVotesInSeatOrder(fresh, options.day, true));
      }
    }
    const pk = config.voting?.exilePolicy === "awa_one_pk_v1";
    const maximum = Math.max(
      0,
      ...Object.entries(tally)
        .filter(([id]) => canBeExiled(this.world, Number(id)))
        .map(([, score]) => score),
    );
    const tied =
      maximum > 0
        ? Object.entries(tally)
            .filter(([id, score]) => score === maximum && canBeExiled(this.world, Number(id)))
            .map(([id]) => Number(id))
        : [];
    let round = 1;
    if (pk && tied.length > 1) {
      this.events.push({
        timestamp: Date.now(),
        type: "vote_summary",
        payload: { votes: publicVotes, tally, target: null, round: 1 },
      });
      this.events.push({
        timestamp: Date.now(),
        type: "exile_pk_started",
        payload: { candidates: tied },
      });
      for (const actorId of tied) {
        if (options.isCurrent?.() === false)
          return {
            summary: { tally: {}, target: null, removed: [] },
            interrupted: false,
            removed: [],
          };
        const life = captureNightLife(this.world, actorId);
        if (!life || !canBeExiled(this.world, actorId)) {
          if (options.strictRequired) throw new Error("order_prince_pk_candidate_stale");
          continue;
        }
        const request = requests.create({
          phase: Phase.Voting,
          actorId,
          allowedTools: ["speak"],
          stage: "exile_pk_speech",
          requiresAction: true,
          summary: { key: "request.summary.exile_pk" },
          context: {
            exile_candidates: tied,
            round: 2,
            max_rounds: 2,
            ...(options.strictRequired
              ? { action_failure_policy: "error", allow_fallback: false }
              : {}),
          },
        });
        const action = await actionProvider.getAction(request);
        if (options.isCurrent?.() === false)
          return {
            summary: { tally: {}, target: null, removed: [] },
            interrupted: false,
            removed: [],
          };
        if (
          action?.name !== "speak" ||
          !livingNightLife(this.world, life) ||
          !canBeExiled(this.world, actorId)
        ) {
          if (options.strictRequired) throw new Error("order_prince_pk_speech_missing_or_stale");
          continue;
        }
        const result = this.toolGateway.validateAndSanitize(this.world, actorId, action, {
          phase: Phase.Voting,
          day: options.day,
        });
        if (
          options.strictRequired &&
          (!result.ok || !result.sanitizedCall || !livingNightLife(this.world, life))
        )
          throw new Error("order_prince_pk_speech_invalid");
        if (result.ok && result.sanitizedCall && livingNightLife(this.world, life))
          this.events.push({
            timestamp: Date.now(),
            type: "day_speech",
            payload: { actorId, text: result.sanitizedCall.args.text },
          });
      }
      const candidates = tied.filter((id) => canBeExiled(this.world, id));
      const revoters = this.world
        .getAliveEntityIds()
        .filter((id) => !tied.includes(id) && canVoteExile(this.world, id, options.day));
      const results = await this.collectVotes(
        revoters,
        requests,
        actionProvider,
        options,
        candidates,
      );
      if (options.isCurrent?.() === false)
        return {
          summary: { tally: {}, target: null, removed: [] },
          interrupted: false,
          removed: [],
        };
      ({ tally, publicVotes } = this.recordVotesInSeatOrder(
        results,
        options.day,
        options.strictRequired,
      ));
      round = 2;
    }

    const target = this.pickMajorityTarget(
      Object.fromEntries(
        Object.entries(tally).filter(([id]) => canBeExiled(this.world, Number(id))),
      ),
      pk ? "no_elimination" : (config.tieBreaker?.exileVote ?? "min_id"),
    );
    this.events.push({
      timestamp: Date.now(),
      type: "vote_summary",
      payload: {
        votes: publicVotes,
        tally,
        target,
        ...(pk ? { round } : {}),
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

    const mapped = config.trickster ? resolveTricksterExile(this.world, options.day, target) : null;
    if (mapped)
      this.events.push({ timestamp: Date.now(), type: "exile_target_mapped", payload: mapped });
    const effectiveTarget = mapped?.effectiveId ?? target;
    const votedOut = mapped?.missed
      ? { removed: [] }
      : this.eventRegistry.onVotedOut(this.world, effectiveTarget, this.events);
    const removed = [...votedOut.removed];

    if (removed.includes(effectiveTarget)) {
      // 只有真正出局才广播 voted_out；白痴翻牌由事件总线单独广播。
      this.events.push({
        timestamp: Date.now(),
        type: "voted_out",
        payload: {
          target: effectiveTarget,
        },
      });
    }

    return {
      summary: {
        tally,
        target,
        ...(mapped ? { effectiveTarget: mapped.missed ? null : effectiveTarget } : {}),
        removed,
      },
      interrupted: false,
      removed,
    };
  }

  private async collectVotes(
    voters: EntityId[],
    requests: GameActionRequestFactory,
    actionProvider: ActionProvider,
    options: VotingPipelineOptions,
    candidates?: EntityId[],
  ): Promise<Array<CollectedVote | null>> {
    // Capture the entire round before invoking any provider, including synchronous fakes.
    const voterLives = voters.map((voterId) => ({
      voterId,
      life: captureNightLife(this.world, voterId),
    }));
    const targetLives = new Map(
      (candidates ?? this.world.getAliveEntityIds()).flatMap((id) => {
        const life = captureNightLife(this.world, id);
        return life ? [[id, life] as const] : [];
      }),
    );
    return Promise.all(
      voterLives.map(({ voterId, life }) =>
        life
          ? this.collectVoterVote(
              voterId,
              life,
              targetLives,
              requests,
              actionProvider,
              options,
              candidates,
            )
          : null,
      ),
    );
  }

  private async collectVoterVote(
    voterId: EntityId,
    voterLife: NonNullable<ReturnType<typeof captureNightLife>>,
    targetLives: ReadonlyMap<EntityId, NonNullable<ReturnType<typeof captureNightLife>>>,
    requests: GameActionRequestFactory,
    actionProvider: ActionProvider,
    options: VotingPipelineOptions,
    candidates?: EntityId[],
  ): Promise<CollectedVote | null> {
    const current = () => {
      const valid =
        options.isCurrent?.() !== false &&
        livingNightLife(this.world, voterLife) &&
        canVoteExile(this.world, voterId, options.day) &&
        !candidates?.includes(voterId);
      if (!valid && options.strictRequired) throw new Error("order_prince_revote_actor_stale");
      return valid;
    };
    const maxRetries = VotingPipeline.MAX_VOTE_RETRIES;
    let retryReason = "";
    const recordRetry = (attempt: number) =>
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "vote_retry_requested",
        actorId: voterId,
        phase: Phase.Voting,
        status: "fallback",
        reason: retryReason,
        output: { attempt, max_retries: maxRetries },
      });

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      if (!current()) return null;
      const baseRequest = requests.create({
        phase: Phase.Voting,
        actorId: voterId,
        allowedTools: ["vote"],
        stage: candidates
          ? "exile_pk_vote"
          : options.orderPrinceRevote
            ? "order_prince_revote"
            : "voting",
        requiresAction: true,
        summary: { key: "request.summary.exile_vote" },
        context: {
          ...(candidates ? { exile_candidates: candidates, round: 2, max_rounds: 2 } : {}),
          ...(options.strictRequired
            ? { action_failure_policy: "error", allow_fallback: false }
            : {}),
        },
      });
      const request =
        attempt === 1
          ? baseRequest
          : {
              ...baseRequest,
              context: {
                ...baseRequest.context,
                retry_attempt: attempt - 1,
                retry_max: maxRetries,
                retry_reason: retryReason,
                retry_notice_message: { key: "request.retry.exile_vote" as const },
              },
            };
      if (!current()) return null;
      const action = await actionProvider.getAction(request);
      if (!current()) return null;
      if (action?.name !== "vote") {
        retryReason = "no_valid_vote_tool_call";
        if (attempt <= maxRetries) {
          recordRetry(attempt);
          continue;
        }
        break;
      }

      const result = this.toolGateway.validateAndSanitize(this.world, voterId, action, {
        phase: Phase.Voting,
        day: options.day,
        exileCandidates: candidates,
      });
      if (
        !result.ok ||
        !result.sanitizedCall ||
        (!result.sanitizedCall.args.abstain &&
          (!targetLives.get(result.sanitizedCall.args.target_id!) ||
            !livingNightLife(this.world, targetLives.get(result.sanitizedCall.args.target_id!)!)))
      ) {
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
        voterLife,
        ...(result.sanitizedCall.args.target_id !== null
          ? { targetLife: targetLives.get(result.sanitizedCall.args.target_id) }
          : {}),
      };
    }

    if (!current()) return null;
    if (options.strictRequired) throw new Error("order_prince_revote_action_missing_or_invalid");
    // Exhausted requests become an explicit abstention when the gateway accepts it.
    const repaired = this.toolGateway.validateAndSanitize(
      this.world,
      voterId,
      { name: "vote", args: { target_id: null, abstain: true } },
      { phase: Phase.Voting, day: options.day, exileCandidates: candidates },
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
      return { voterId, targetId: null, abstain: true, fallback: true, voterLife };
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

  private recordVotesInSeatOrder(
    votes: Array<CollectedVote | null>,
    day: number,
    strictRequired = false,
  ): {
    tally: Record<number, number>;
    publicVotes: VoteRecord[];
  } {
    const tally: Record<number, number> = {};
    const publicVotes: VoteRecord[] = [];
    for (const vote of votes) {
      if (!vote) continue;
      const { voterId } = vote;
      if (
        !livingNightLife(this.world, vote.voterLife) ||
        (!vote.abstain && (!vote.targetLife || !livingNightLife(this.world, vote.targetLife))) ||
        !canVoteExile(this.world, voterId, day) ||
        (!vote.abstain && vote.targetId !== null && !canBeExiled(this.world, vote.targetId))
      ) {
        if (strictRequired) throw new Error("order_prince_revote_ballot_stale");
        continue;
      }
      let weight = 0;
      if (!vote.abstain && vote.targetId !== null) {
        const voting = this.world.getComponent<VotingRightComponent>(
          voterId,
          COMPONENT.VotingRight,
        );
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
      publicVotes.push({
        actorId: voterId,
        targetId: vote.targetId,
        abstain: vote.abstain,
        weight,
      });
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
          this.world.getComponent<IdentityComponent>(aId, COMPONENT.Identity)?.seat ?? aId;
        const bSeat =
          this.world.getComponent<IdentityComponent>(bId, COMPONENT.Identity)?.seat ?? bId;
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
