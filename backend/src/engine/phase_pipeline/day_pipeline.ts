import { AliveComponent } from "../../domain/components/alive";
import { BadgeComponent } from "../../domain/components/badge";
import { COMPONENT } from "../../domain/components/names";
import { IdentityComponent } from "../../domain/entities/player";
import { RoleComponent } from "../../domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  ActionWindow,
  BoardConfig,
  DaySummary,
  EntityId,
  GameEvent,
  Phase,
  Role,
} from "../../domain/model";
import { ToolGateway } from "../../gateway/tool_gateway";
import { World } from "../../domain/world";
import { buildAgentBroadcastFeed } from "../agent_broadcast_feed";

/**
 * 白天流水线执行结果。
 */
export interface DayPipelineResult {
  summary: DaySummary;
  interrupted: boolean;
}

/**
 * 白天阶段流水线：
 * 1) 先由警长选择发言方向（若启用警长且警徽有效）。
 * 2) 按顺序串行发言并写入事件流。
 * 3) 在可配置窗口中允许狼人自爆中断流程。
 */
export class DayPipeline {
  constructor(
    private readonly world: World,
    private readonly toolGateway: ToolGateway,
    private readonly events: GameEvent[],
  ) {}

  async execute(
    config: BoardConfig,
    actionProvider: ActionProvider,
  ): Promise<DayPipelineResult> {
    const speeches: DaySummary["speeches"] = [];
    const speakerDirection = await this.chooseSpeakerDirection(
      config,
      actionProvider,
    );

    if (config.hooks.onDaybreak) {
      const exploded = await this.trySelfDestruct(
        actionProvider,
        ActionWindow.OnDaybreak,
      );
      if (exploded !== null) {
        return {
          summary: {
            speeches,
            selfDestructBy: exploded,
          },
          interrupted: true,
        };
      }
    }

    if (config.hooks.onPreElection) {
      const exploded = await this.trySelfDestruct(
        actionProvider,
        ActionWindow.OnPreElection,
      );
      if (exploded !== null) {
        return {
          summary: {
            speeches,
            selfDestructBy: exploded,
          },
          interrupted: true,
        };
      }
    }

    const speakers = this.buildSpeakerOrder(
      this.world.getAliveEntityIds(),
      this.findSheriffId(),
      speakerDirection,
    );

    for (const actorId of speakers) {
      if (!this.isAlive(actorId)) {
        continue;
      }

      const req: ActionRequest = {
        phase: Phase.Day,
        actorId,
        allowedTools: ["speak"],
        context: {
          phase: "day_speech",
          must_act: true,
          broadcast_feed: buildAgentBroadcastFeed(this.world, this.events, actorId),
        },
      };

      const action = await actionProvider.getAction(req);
      if (action?.name === "speak") {
        const result = this.toolGateway.validateAndSanitize(
          this.world,
          actorId,
          action,
          { phase: Phase.Day },
        );

        if (result.ok && result.sanitizedCall) {
          speeches.push({
            actorId,
            text: result.sanitizedCall.args.text,
          });
          this.events.push({
            timestamp: Date.now(),
            type: "day_speech",
            payload: {
              actorId,
              text: result.sanitizedCall.args.text,
            },
          });
        }
      }

      if (config.hooks.onPerSpeechGap) {
        const exploded = await this.trySelfDestruct(
          actionProvider,
          ActionWindow.OnPerSpeechGap,
        );
        if (exploded !== null) {
          return {
            summary: {
              speeches,
              selfDestructBy: exploded,
            },
            interrupted: true,
          };
        }
      }
    }

    return {
      summary: {
        speeches,
        selfDestructBy: null,
      },
      interrupted: false,
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
        phase: Phase.Day,
        actionWindow: window,
        actorId: wolfId,
        allowedTools: ["self_destruct"],
        context: {
          window,
          must_act: false,
          broadcast_feed: buildAgentBroadcastFeed(this.world, this.events, wolfId),
        },
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
          phase: Phase.Day,
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

      // 自爆成功后立即标记死亡，调用方会根据 interrupted 直接跳夜。
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

  /**
   * 查询当前存活且警徽未销毁的警长。
   */
  private findSheriffId(): EntityId | null {
    const sheriff = this.world.getAliveEntityIds().find((id) => {
      const badge = this.world.getComponent<BadgeComponent>(id, COMPONENT.Badge);
      return badge?.isSheriff === true && badge.destroyed === false;
    });
    return sheriff ?? null;
  }

  private async chooseSpeakerDirection(
    config: BoardConfig,
    actionProvider: ActionProvider,
  ): Promise<"clockwise" | "counter_clockwise"> {
    if (!config.enableSheriff) {
      return "clockwise";
    }

    const sheriffId = this.findSheriffId();
    if (sheriffId === null) {
      return "clockwise";
    }

    const req: ActionRequest = {
      phase: Phase.Day,
      actorId: sheriffId,
      allowedTools: ["choose_direction"],
      context: {
        phase: "sheriff_choose_direction",
        must_act: true,
        broadcast_feed: buildAgentBroadcastFeed(this.world, this.events, sheriffId),
      },
    };
    const action = await actionProvider.getAction(req);
    if (action?.name !== "choose_direction") {
      return "clockwise";
    }

    const result = this.toolGateway.validateAndSanitize(
      this.world,
      sheriffId,
      action,
      { phase: Phase.Day },
    );
    if (!result.ok || !result.sanitizedCall) {
      return "clockwise";
    }

    // 发言方向作为显式事件广播，便于前端和回放系统复现白天顺序。
    this.events.push({
      timestamp: Date.now(),
      type: "sheriff_direction_chosen",
      payload: {
        sheriffId,
        direction: result.sanitizedCall.args.direction,
      },
    });

    return result.sanitizedCall.args.direction;
  }

  private buildSpeakerOrder(
    aliveIds: EntityId[],
    sheriffId: EntityId | null,
    direction: "clockwise" | "counter_clockwise",
  ): EntityId[] {
    if (sheriffId === null) {
      return [...aliveIds];
    }

    const seatMap = new Map<EntityId, number>();
    for (const id of aliveIds) {
      const identity = this.world.getComponent<IdentityComponent>(
        id,
        COMPONENT.Identity,
      );
      if (identity) {
        seatMap.set(id, identity.seat);
      }
    }

    const orderedBySeat = [...aliveIds].sort((a, b) => {
      return (seatMap.get(a) ?? a) - (seatMap.get(b) ?? b);
    });
    const sheriffIndex = orderedBySeat.indexOf(sheriffId);
    if (sheriffIndex < 0) {
      return orderedBySeat;
    }

    const clockwiseOrder = [
      ...orderedBySeat.slice(sheriffIndex + 1),
      ...orderedBySeat.slice(0, sheriffIndex + 1),
    ];

    if (direction === "clockwise") {
      return clockwiseOrder;
    }

    // 警右（逆时针）从警长前一位开始逆向遍历，最后把警长放到末位。
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

  /**
   * 判断目标玩家是否存活。
   */
  private isAlive(entityId: EntityId): boolean {
    const alive = this.world.getComponent<AliveComponent>(entityId, COMPONENT.Alive);
    return alive?.alive === true;
  }
}
