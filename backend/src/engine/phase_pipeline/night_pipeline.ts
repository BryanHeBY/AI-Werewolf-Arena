import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { StatusMarksComponent } from "../../domain/components/status_marks";
import {
  ActionProvider,
  ActionRequest,
  BoardConfig,
  EntityId,
  GameEvent,
  NightSummary,
  Phase,
  Role,
} from "../../domain/model";
import { RoleRegistry } from "../../domain/registries/role_registry";
import {
  DamageResolutionResult,
  DamageResolutionSystem,
} from "../../domain/systems/damage_resolution_system";
import { World } from "../../domain/world";
import { ToolGateway } from "../../gateway/tool_gateway";
import {
  getDefaultNightStageRegistry,
  NightStageRegistry,
  NightStageState,
} from "../../mechanisms";
import { safeRecordLogicOp } from "../../session_recording";
import { buildAgentBroadcastFeed } from "../agent_broadcast_feed";

/**
 * 夜间阶段流水线：
 * - 通过 NightStageRegistry 串行驱动夜间子阶段；
 * - 最后统一执行伤害结算并生成 night_resolved 事件。
 */
export class NightPipeline {
  constructor(
    private readonly world: World,
    private readonly _roleRegistry: RoleRegistry,
    private readonly toolGateway: ToolGateway,
    private readonly damageResolutionSystem: DamageResolutionSystem,
    private readonly events: GameEvent[],
    private readonly stageRegistry: NightStageRegistry = getDefaultNightStageRegistry(),
  ) {}

  /**
   * 执行完整夜间流程并返回结算摘要与伤害结果。
   */
  async execute(config: BoardConfig, actionProvider: ActionProvider): Promise<{
    summary: NightSummary;
    damage: DamageResolutionResult;
  }> {
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "night_pipeline_start",
      phase: Phase.Night,
      status: "ok",
      input: {
        board_size: config.boardSize,
      },
    });

    const stageState: NightStageState = {
      wolfIds: [],
      endedWolves: new Set<EntityId>(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
    };

    const stageCtx = {
      world: this.world,
      toolGateway: this.toolGateway,
      events: this.events,
      actionProvider,
      currentDay: () => this.currentDay(),
      makeRequest: (
        actorId: EntityId,
        allowedTools: ActionRequest["allowedTools"],
        context: ActionRequest["context"],
      ) => this.makeRequest(actorId, allowedTools, context),
      getAliveByRole: (role: Role) => this.getAliveByRole(role),
      ensureMarks: (entityId: EntityId) => this.ensureMarks(entityId),
      pickMajorityTarget: (votes: Record<number, number>) =>
        this.pickMajorityTarget(votes),
      shuffleWolves: (ids: EntityId[]) => this.shuffleWolves(ids),
      state: stageState,
    };

    for (const stage of this.stageRegistry.getStages(config)) {
      await stage.execute(stageCtx);
    }

    const damage = this.damageResolutionSystem.resolve(this.world);
    safeRecordLogicOp({
      scope: "resolution",
      op: "night_damage_resolved",
      phase: Phase.Night,
      status: "ok",
      output: {
        deaths: damage.deaths,
        death_sources: damage.deathSources,
      },
    });

    const summary: NightSummary = {
      wolfTarget: stageState.wolfTarget,
      deaths: [...damage.deaths],
      seerChecks: stageState.seerChecks,
      interruptedBySelfDestruct: false,
    };

    this.events.push({
      timestamp: Date.now(),
      type: "night_resolved",
      payload: {
        wolfTarget: summary.wolfTarget,
        deaths: summary.deaths,
      },
    });

    return { summary, damage };
  }

  private makeRequest(
    actorId: EntityId,
    allowedTools: ActionRequest["allowedTools"],
    context: ActionRequest["context"],
  ): ActionRequest {
    return {
      phase: Phase.Night,
      actorId,
      allowedTools,
      context: {
        day: this.currentDay(),
        must_act: true,
        broadcast_feed: buildAgentBroadcastFeed(this.world, this.events, actorId),
        ...context,
      },
    };
  }

  /**
   * 获取指定角色的存活玩家列表。
   */
  private getAliveByRole(role: Role): EntityId[] {
    return this.world.getAliveEntityIds().filter((id) => {
      const roleComp = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return roleComp?.role === role;
    });
  }

  /**
   * 获取或创建目标玩家的状态印记组件。
   */
  private ensureMarks(entityId: EntityId): StatusMarksComponent {
    let marks = this.world.getComponent<StatusMarksComponent>(
      entityId,
      COMPONENT.StatusMarks,
    );
    if (!marks) {
      // 标记组件按需创建，避免无状态玩家占用冗余存储。
      marks = new StatusMarksComponent();
      this.world.addComponent(entityId, COMPONENT.StatusMarks, marks);
    }
    return marks;
  }

  /**
   * 依据票数选出狼刀目标，平票按编号最小值决议。
   */
  private pickMajorityTarget(votes: Record<number, number>): EntityId | null {
    const entries = Object.entries(votes);
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

  /**
   * 生成狼人随机顺序（供夜聊与投票复用）。
   */
  private shuffleWolves(ids: EntityId[]): EntityId[] {
    // 夜间狼人发言与投票必须共用同一随机顺序，以便回放可追踪。
    const copied = [...ids];
    for (let i = copied.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied;
  }
}
