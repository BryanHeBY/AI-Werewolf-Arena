import { AliveComponent } from "../../../core/domain/components/alive";
import { COMPONENT } from "../../../core/domain/components/names";
import {
  ActionProvider,
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
import { World } from "../../../core/domain/world";
import { GameActionRequestFactory } from "../action_request_factory";

/**
 * 白天流水线执行结果。
 */
export interface DayPipelineResult {
  summary: DaySummary;
  interrupted: boolean;
}

export interface DayPipelineOptions {
  /** 当前日次由 PhaseManager 显式传入，不能从事件历史反推。 */
  day: number;
  afterSheriffElection?: () => Promise<void>;
}

export interface DayPipelineDependencies {
  world: World;
  roleRegistry: RoleRegistry;
  toolGateway: ToolGateway;
  events: GameEvent[];
  sheriffMechanism?: SheriffMechanism;
}

/**
 * 白天阶段流水线：
 * 1) 由警长机制决定发言方向与顺序（若启用警长）。
 * 2) 按顺序串行发言并写入事件流。
 * 3) 在可配置窗口中允许自爆中断流程。
 */
export class DayPipeline {
  private readonly world: World;
  private readonly roleRegistry: RoleRegistry;
  private readonly toolGateway: ToolGateway;
  private readonly events: GameEvent[];
  private readonly sheriffMechanism: SheriffMechanism;

  constructor(dependencies: DayPipelineDependencies) {
    this.world = dependencies.world;
    this.roleRegistry = dependencies.roleRegistry;
    this.toolGateway = dependencies.toolGateway;
    this.events = dependencies.events;
    this.sheriffMechanism =
      dependencies.sheriffMechanism ?? getDefaultSheriffMechanism();
  }

  async execute(
    config: BoardConfig,
    actionProvider: ActionProvider,
    options: DayPipelineOptions,
  ): Promise<DayPipelineResult> {
    const speeches: DaySummary["speeches"] = [];
    const requests = new GameActionRequestFactory(
      this.world,
      this.events,
      options.day,
    );
    await this.sheriffMechanism.electSheriffIfNeeded({
      world: this.world,
      events: this.events,
      toolGateway: this.toolGateway,
      actionProvider,
      day: options.day,
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
      day: options.day,
      enableSheriff: config.enableSheriff,
    });

    if (config.hooks.onDaybreak && this.isSelfDestructWindowEnabled(config, ActionWindow.OnDaybreak)) {
      const exploded = await this.trySelfDestruct(
        requests,
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

    if (config.hooks.onPreElection && this.isSelfDestructWindowEnabled(config, ActionWindow.OnPreElection)) {
      const exploded = await this.trySelfDestruct(
        requests,
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

      const req = requests.create({
        phase: Phase.Day,
        actorId,
        allowedTools: ["speak"],
        stage: "day_speech",
        requiresAction: true,
        summary: "白天发言阶段必须完成一次发言动作。",
        context: {
        },
      });

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
        const exploded = await this.trySelfDestruct(
          requests,
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

    const picks = await Promise.all(
      actors.map(async (actorId) => {
        const req = requests.create({
          phase: Phase.Day,
          actionWindow: window,
          actorId,
          allowedTools: ["self_destruct"],
          stage: window,
          requiresAction: false,
          summary: "自爆窗口可选择执行自爆，也可直接结束回合。",
          context: {
          },
        });

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
