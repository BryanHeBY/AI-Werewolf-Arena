import { AliveComponent } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { VotingRightComponent } from "../../domain/components/voting_right";
import {
  ActionProvider,
  ActionRequest,
  ActionWindow,
  BoardConfig,
  EntityId,
  GameEvent,
  Phase,
  Role,
  VotingSummary,
} from "../../domain/model";
import { ToolGateway } from "../../gateway/tool_gateway";
import { safeRecordLogicOp } from "../../session_recording";
import { EventRegistry } from "../event_registry";
import { World } from "../../domain/world";
import { buildAgentBroadcastFeed } from "../agent_broadcast_feed";

/**
 * 投票流水线执行结果。
 */
export interface VotingPipelineResult {
  summary: VotingSummary;
  interrupted: boolean;
  removed: EntityId[];
}

/**
 * 放逐投票流水线：
 * 1) 在 onPreVote 窗口可触发狼人自爆中断。
 * 2) 存活且有投票权玩家依次投票，按权重计票。
 * 3) 调用 EventRegistry 处理白痴免死、警徽销毁等投后钩子。
 */
export class VotingPipeline {
  constructor(
    private readonly world: World,
    private readonly toolGateway: ToolGateway,
    private readonly eventRegistry: EventRegistry,
    private readonly events: GameEvent[],
  ) {}

  async execute(
    config: BoardConfig,
    actionProvider: ActionProvider,
  ): Promise<VotingPipelineResult> {
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "voting_pipeline_start",
      phase: Phase.Voting,
      status: "ok",
      input: {
        on_pre_vote_hook: config.hooks.onPreVote,
      },
    });
    if (config.hooks.onPreVote) {
      const exploded = await this.trySelfDestruct(
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
        const req: ActionRequest = {
          phase: Phase.Voting,
          actorId: voterId,
          allowedTools: ["vote"],
          context: {
            day: this.currentDay(),
            phase: "voting",
            must_act: true,
            broadcast_feed: buildAgentBroadcastFeed(this.world, this.events, voterId),
          },
        };

        const action = await actionProvider.getAction(req);
        if (action?.name !== "vote") {
          return null;
        }

        const result = this.toolGateway.validateAndSanitize(
          this.world,
          voterId,
          action,
          { phase: Phase.Voting },
        );
        if (!result.ok || !result.sanitizedCall) {
          safeRecordLogicOp({
            scope: "phase_pipeline",
            op: "vote_rejected",
            actorId: voterId,
            phase: Phase.Voting,
            status: "rejected",
          });
          return null;
        }

        return {
          voterId,
          targetId: result.sanitizedCall.args.target_id,
          abstain: result.sanitizedCall.args.abstain === true,
        };
      }),
    );

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
        },
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

    const target = this.pickMajorityTarget(tally);
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
    actionProvider: ActionProvider,
    window: ActionWindow,
  ): Promise<EntityId | null> {
    const wolves = this.world.getAliveEntityIds().filter((id) => {
      const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return role?.role === Role.Wolf;
    });

    // 并行触发狼人自爆思考，减少 pre-vote 窗口总时延。
    const candidates = await Promise.all(
      wolves.map(async (wolfId) => {
        const req: ActionRequest = {
          phase: Phase.Voting,
          actorId: wolfId,
          actionWindow: window,
          allowedTools: ["self_destruct"],
          context: {
            day: this.currentDay(),
            window,
            must_act: false,
            broadcast_feed: buildAgentBroadcastFeed(this.world, this.events, wolfId),
          },
        };

        const action = await actionProvider.getAction(req);
        if (action?.name !== "self_destruct") {
          return null;
        }

        const result = this.toolGateway.validateAndSanitize(
          this.world,
          wolfId,
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
        return wolfId;
      }),
    );

    // 多狼同时自爆请求时按座位/ID 最小值决议，保证确定性。
    const picked = candidates
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
  private pickMajorityTarget(tally: Record<number, number>): EntityId | null {
    const entries = Object.entries(tally);
    if (entries.length === 0) {
      return null;
    }

    entries.sort((a, b) => {
      const voteDiff = b[1] - a[1];
      if (voteDiff !== 0) {
        return voteDiff;
      }
      return Number(a[0]) - Number(b[0]);
    });

    return Number(entries[0][0]);
  }

  private currentDay(): number {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      if (event.type === "phase_changed") {
        const day = Number(event.payload.day ?? 0);
        if (Number.isFinite(day) && day > 0) {
          return day;
        }
      }
    }
    return 1;
  }
}
