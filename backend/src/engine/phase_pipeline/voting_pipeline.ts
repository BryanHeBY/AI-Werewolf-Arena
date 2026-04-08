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
import { EventRegistry } from "../event_registry";
import { World } from "../../domain/world";

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
    if (config.hooks.onPreVote) {
      const exploded = await this.trySelfDestruct(
        actionProvider,
        ActionWindow.OnPreVote,
      );
      if (exploded !== null) {
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

    for (const voterId of voters) {
      const req: ActionRequest = {
        phase: Phase.Voting,
        actorId: voterId,
        allowedTools: ["vote"],
        context: { phase: "voting" },
      };

      const action = await actionProvider.getAction(req);
      if (action?.name !== "vote") {
        continue;
      }

      const result = this.toolGateway.validateAndSanitize(
        this.world,
        voterId,
        action,
        { phase: Phase.Voting },
      );
      if (!result.ok || !result.sanitizedCall) {
        continue;
      }

      const voteTarget = result.sanitizedCall.args.target_id;
      const voting = this.world.getComponent<VotingRightComponent>(
        voterId,
        COMPONENT.VotingRight,
      );
      // 警长等角色可通过 weight 调整票权，默认 1 票。
      const weight = voting?.weight ?? 1;
      tally[voteTarget] = (tally[voteTarget] ?? 0) + weight;
    }

    const target = this.pickMajorityTarget(tally);
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

    for (const wolfId of wolves) {
      const req: ActionRequest = {
        phase: Phase.Voting,
        actorId: wolfId,
        actionWindow: window,
        allowedTools: ["self_destruct"],
        context: { window },
      };

      const action = await actionProvider.getAction(req);
      if (action?.name !== "self_destruct") {
        continue;
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
        continue;
      }

      const alive = this.world.getComponent<AliveComponent>(wolfId, COMPONENT.Alive);
      if (!alive || !alive.alive) {
        continue;
      }

      alive.alive = false;
      this.events.push({
        timestamp: Date.now(),
        type: "wolf_self_destruct",
        payload: {
          wolfId,
          window,
        },
      });
      return wolfId;
    }

    return null;
  }

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
}
