import { AliveComponent } from "../../../core/domain/components/alive";
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
  VotingSummary,
} from "../../../core/domain/model";
import { RoleRegistry } from "../../../core/domain/registries/role_registry";
import { ToolGateway } from "../../gateway/tool_gateway";
import { safeRecordLogicOp } from "../../../observability";
import { EventRegistry } from "../event_registry";
import { World } from "../../../core/domain/world";
import { GameActionRequestFactory } from "../action_request_factory";

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

/**
 * 放逐投票流水线：
 * 1) 在 onPreVote 窗口可触发狼人自爆中断。
 * 2) 存活且有投票权玩家依次投票，按权重计票。
 * 3) 调用 EventRegistry 处理白痴免死、警徽销毁等投后钩子。
 */
export class VotingPipeline {
  private static readonly MAX_VOTE_RETRIES = 3;
  private readonly world: World;
  private readonly roleRegistry: RoleRegistry;
  private readonly toolGateway: ToolGateway;
  private readonly eventRegistry: EventRegistry;
  private readonly events: GameEvent[];

  constructor(dependencies: VotingPipelineDependencies) {
    this.world = dependencies.world;
    this.roleRegistry = dependencies.roleRegistry;
    this.toolGateway = dependencies.toolGateway;
    this.eventRegistry = dependencies.eventRegistry;
    this.events = dependencies.events;
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
      this.isSelfDestructWindowEnabled(config, ActionWindow.OnPreVote)
    ) {
      const exploded = await this.trySelfDestruct(
        requests,
        actionProvider,
        ActionWindow.OnPreVote,
      );
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

    const tally: Record<number, number> = {};
    // 投票请求并行发起，降低长轮次等待；事件落库仍按 voter 顺序写入，保证回放稳定。
    const voteResults = await Promise.all(
      voters.map(async (voterId) => {
        const maxRetries = VotingPipeline.MAX_VOTE_RETRIES;
        const baseRequest = () => requests.create({
          phase: Phase.Voting,
          actorId: voterId,
          allowedTools: ["vote"],
          stage: "voting",
          requiresAction: true,
          summary: "放逐投票阶段必须完成一次投票动作（可弃票）。",
          context: {
          },
        });

        let retryReason = "";
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
          const req =
            attempt === 1
              ? baseRequest()
              : {
                  ...baseRequest(),
                  context: {
                    ...baseRequest().context,
                    retry_attempt: attempt - 1,
                    retry_max: maxRetries,
                    retry_reason: retryReason,
                    retry_notice:
                      "你的投票动作无效，请严格调用 vote 工具重新行动。",
                  },
                };
          const action = await actionProvider.getAction(req);
          if (action?.name !== "vote") {
            retryReason = "no_valid_vote_tool_call";
            if (attempt <= maxRetries) {
              safeRecordLogicOp({
                scope: "phase_pipeline",
                op: "vote_retry_requested",
                actorId: voterId,
                phase: Phase.Voting,
                status: "fallback",
                reason: retryReason,
                output: {
                  attempt,
                  max_retries: maxRetries,
                },
              });
              continue;
            }
            break;
          }

          const result = this.toolGateway.validateAndSanitize(
            this.world,
            voterId,
            action,
            { phase: Phase.Voting },
          );
          if (!result.ok || !result.sanitizedCall) {
            retryReason = "invalid_vote_arguments";
            if (attempt <= maxRetries) {
              safeRecordLogicOp({
                scope: "phase_pipeline",
                op: "vote_retry_requested",
                actorId: voterId,
                phase: Phase.Voting,
                status: "fallback",
                reason: retryReason,
                output: {
                  attempt,
                  max_retries: maxRetries,
                },
              });
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

        // 重试耗尽后降级为弃票，避免该玩家整轮无票导致流程信息断层。
        const repaired = this.toolGateway.validateAndSanitize(
          this.world,
          voterId,
          {
            name: "vote",
            args: {
              target_id: null,
              abstain: true,
            },
          },
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
          return {
            voterId,
            targetId: null as EntityId | null,
            abstain: true,
            fallback: true,
          };
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
      }),
    );

    const publicVotes: Array<{
      actorId: EntityId;
      targetId: EntityId | null;
      abstain: boolean;
      weight: number;
    }> = [];
    for (const voterId of voters) {
      const vote = voteResults.find((item) => item?.voterId === voterId);
      if (!vote) {
        continue;
      }
      let weight = 0;
      if (!vote.abstain && vote.targetId !== null) {
        const voting = this.world.getComponent<VotingRightComponent>(
          voterId,
          COMPONENT.VotingRight,
        );
        // 警长等角色可通过 weight 调整票权，默认 1 票。
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
        output: {
          target_id: vote.targetId,
          abstain: vote.abstain,
          weight,
        },
      });
    }

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

    if (!votedOut.prevented) {
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

  private async trySelfDestruct(
    requests: GameActionRequestFactory,
    actionProvider: ActionProvider,
    window: ActionWindow,
  ): Promise<EntityId | null> {
    const actors = this.world.getAliveEntityIds().filter((id) => {
      const role = this.world.getComponent<{ role: any }>(id, COMPONENT.Role);
      if (!role) {
        return false;
      }
      return this.roleRegistry.getAllowedTools(role.role).includes("self_destruct");
    });

    // 并行触发狼人自爆思考，减少 pre-vote 窗口总时延。
    const picks = await Promise.all(
      actors.map(async (actorId) => {
        const req = requests.create({
          phase: Phase.Voting,
          actorId,
          actionWindow: window,
          allowedTools: ["self_destruct"],
          stage: window,
          requiresAction: false,
          summary: "放逐前自爆窗口可选择执行自爆，也可结束回合。",
          context: {
          },
        });

        const action = await actionProvider.getAction(req);
        if (action?.name !== "self_destruct") {
          return null;
        }

        const result = this.toolGateway.validateAndSanitize(
          this.world,
          actorId,
          action,
          {
            phase: Phase.Voting,
            actionWindow: window,
            allowSelfDestruct: true,
          },
        );
        if (!result.ok) {
          return null;
        }
        return actorId;
      }),
    );

    // 多狼同时自爆请求时按座位/ID 最小值决议，保证确定性。
    const picked = picks
      .filter((id): id is EntityId => id !== null)
      .sort((a, b) => a - b)[0];
    if (picked === undefined) {
      return null;
    }

    const alive = this.world.getComponent<AliveComponent>(picked, COMPONENT.Alive);
    if (!alive || !alive.alive) {
      return null;
    }

    alive.alive = false;
    this.events.push({
      timestamp: Date.now(),
      type: "wolf_self_destruct",
      payload: {
        wolfId: picked,
        window,
      },
    });
    return picked;
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

  private isSelfDestructWindowEnabled(
    config: BoardConfig,
    window: ActionWindow,
  ): boolean {
    const enabled = config.selfDestruct?.enabledWindows;
    if (!enabled || enabled.length === 0) {
      return window === ActionWindow.OnPreVote;
    }
    return enabled.includes(window);
  }
}
