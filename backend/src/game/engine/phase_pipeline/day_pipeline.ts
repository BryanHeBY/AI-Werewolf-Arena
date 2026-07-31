import { AliveComponent } from "../../../core/domain/components/alive";
import { COMPONENT } from "../../../core/domain/components/names";
import {
  ActionProvider,
  ActionRequest,
  ActionWindow,
  BoardConfig,
  DaySummary,
  EntityId,
  GameEvent,
  Phase,
} from "../../../core/domain/model";
import { RoleRegistry } from "../../../core/domain/registries/role_registry";
import { ToolGateway } from "../../gateway/tool_gateway";
import { getDefaultSheriffMechanism, SheriffMechanism } from "../../mechanisms";
import { RoleSpecRegistry } from "../../mechanisms/registries/role_spec_registry";
import { World } from "../../../core/domain/world";
import { buildAgentVisibleEventFeed } from "../agent_visible_event_feed";
import { buildTurnConstraintContext } from "../turn_constraints_context";

/**
 * 白天流水线执行结果。
 */
export interface DayPipelineResult {
  summary: DaySummary;
  interrupted: boolean;
}

export interface DayPipelineOptions {
  afterSheriffElection?: () => Promise<void>;
}

/**
 * 白天阶段流水线：
 * 1) 由警长机制决定发言方向与顺序（若启用警长）。
 * 2) 按顺序串行发言并写入事件流。
 * 3) 在可配置窗口中允许自爆中断流程。
 */
export class DayPipeline {
  private readonly roleRegistry: RoleRegistry;
  private readonly toolGateway: ToolGateway;
  private readonly events: GameEvent[];
  private readonly sheriffMechanism: SheriffMechanism;

  constructor(
    private readonly world: World,
    roleRegistryOrToolGateway: RoleRegistry | ToolGateway,
    toolGatewayOrEvents: ToolGateway | GameEvent[],
    eventsOrSheriff?: GameEvent[] | SheriffMechanism,
    sheriffMaybe?: SheriffMechanism,
  ) {
    // 兼容旧签名：(world, toolGateway, events)
    if (Array.isArray(toolGatewayOrEvents)) {
      this.roleRegistry = new RoleRegistry();
      for (const spec of new RoleSpecRegistry().all()) {
        this.roleRegistry.registerAllowedTools(spec.role, spec.allowedTools);
      }
      this.toolGateway = roleRegistryOrToolGateway as ToolGateway;
      this.events = toolGatewayOrEvents;
      this.sheriffMechanism =
        (eventsOrSheriff as SheriffMechanism | undefined) ??
        getDefaultSheriffMechanism();
      return;
    }

    this.roleRegistry = roleRegistryOrToolGateway as RoleRegistry;
    this.toolGateway = toolGatewayOrEvents;
    this.events = (eventsOrSheriff as GameEvent[] | undefined) ?? [];
    this.sheriffMechanism = sheriffMaybe ?? getDefaultSheriffMechanism();
  }

  async execute(
    config: BoardConfig,
    actionProvider: ActionProvider,
    options?: DayPipelineOptions,
  ): Promise<DayPipelineResult> {
    const speeches: DaySummary["speeches"] = [];
    await this.sheriffMechanism.electSheriffIfNeeded({
      world: this.world,
      events: this.events,
      toolGateway: this.toolGateway,
      actionProvider,
      day: this.currentDay(),
      enableSheriff: config.enableSheriff,
      config,
    });
    if (options?.afterSheriffElection) {
      await options.afterSheriffElection();
    }
    const speakerDirection = await this.sheriffMechanism.chooseSpeakerDirection({
      world: this.world,
      events: this.events,
      toolGateway: this.toolGateway,
      actionProvider,
      day: this.currentDay(),
      enableSheriff: config.enableSheriff,
    });

    if (config.hooks.onDaybreak && this.isSelfDestructWindowEnabled(config, ActionWindow.OnDaybreak)) {
      const exploded = await this.trySelfDestruct(actionProvider, ActionWindow.OnDaybreak);
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

    if (config.hooks.onPreElection && this.isSelfDestructWindowEnabled(config, ActionWindow.OnPreElection)) {
      const exploded = await this.trySelfDestruct(actionProvider, ActionWindow.OnPreElection);
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

    const speakers = this.sheriffMechanism.buildSpeakerOrder(
      this.world,
      this.world.getAliveEntityIds(),
      this.sheriffMechanism.findSheriffId(this.world),
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
          day: this.currentDay(),
          phase: "day_speech",
          turn_constraints: buildTurnConstraintContext({
            requiresAction: true,
            allowedTools: ["speak"],
            summary: "白天发言阶段必须完成一次发言动作。",
          }),
          visible_events: buildAgentVisibleEventFeed(this.world, this.events, actorId),
        },
      };

      const action = await actionProvider.getAction(req);
      if (action?.name === "speak") {
        const result = this.toolGateway.validateAndSanitize(this.world, actorId, action, {
          phase: Phase.Day,
        });

        if (result.ok && result.sanitizedCall) {
          speeches.push({ actorId, text: result.sanitizedCall.args.text });
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

      if (
        config.hooks.onPerSpeechGap &&
        this.isSelfDestructWindowEnabled(config, ActionWindow.OnPerSpeechGap)
      ) {
        const exploded = await this.trySelfDestruct(actionProvider, ActionWindow.OnPerSpeechGap);
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
    const actors = this.world.getAliveEntityIds().filter((id) => {
      const role = this.world.getComponent<{ role: any }>(id, COMPONENT.Role);
      if (!role) {
        return false;
      }
      return this.roleRegistry.getAllowedTools(role.role).includes("self_destruct");
    });

    const picks = await Promise.all(
      actors.map(async (actorId) => {
        const req: ActionRequest = {
          phase: Phase.Day,
          actionWindow: window,
          actorId,
          allowedTools: ["self_destruct"],
          context: {
            day: this.currentDay(),
            window,
            turn_constraints: buildTurnConstraintContext({
              requiresAction: false,
              allowedTools: ["self_destruct"],
              summary: "自爆窗口可选择执行自爆，也可直接结束回合。",
            }),
              visible_events: buildAgentVisibleEventFeed(this.world, this.events, actorId),
          },
        };

        const action = await actionProvider.getAction(req);
        if (action?.name !== "self_destruct") {
          return null;
        }

        const result = this.toolGateway.validateAndSanitize(this.world, actorId, action, {
          phase: Phase.Day,
          actionWindow: window,
          allowSelfDestruct: true,
        });
        if (!result.ok) {
          return null;
        }
        return actorId;
      }),
    );

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

  /**
   * 判断目标玩家是否存活。
   */
  private isAlive(entityId: EntityId): boolean {
    const alive = this.world.getComponent<AliveComponent>(entityId, COMPONENT.Alive);
    return alive?.alive === true;
  }
}
