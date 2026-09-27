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
import { electSheriffIfNeeded } from "../../mechanisms/sheriff/election";
import { buildSpeakerOrder, chooseSpeakerDirection } from "../../mechanisms/sheriff/speaking_order";
import { findSheriffId } from "../../mechanisms/sheriff/badge";
import { World } from "../../../core/domain/world";
import { GameActionRequestFactory } from "../action_request_factory";
import { SelfDestructWindow, isSelfDestructWindowEnabled } from "../self_destruct_window";

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
  /** 返回 true 表示已终局，不再请求白天行动。 */
  afterSheriffElection?: () => Promise<boolean>;
}

export interface DayPipelineDependencies {
  world: World;
  roleRegistry: RoleRegistry;
  toolGateway: ToolGateway;
  events: GameEvent[];
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
  private readonly selfDestructWindow: SelfDestructWindow;
  constructor(dependencies: DayPipelineDependencies) {
    this.world = dependencies.world;
    this.roleRegistry = dependencies.roleRegistry;
    this.toolGateway = dependencies.toolGateway;
    this.events = dependencies.events;
    this.selfDestructWindow = new SelfDestructWindow(this.world, this.roleRegistry, this.toolGateway, this.events);
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
    await electSheriffIfNeeded({
      world: this.world,
      events: this.events,
      toolGateway: this.toolGateway,
      actionProvider,
      day: options.day,
      enableSheriff: config.enableSheriff,
      config,
    });
    if (await options.afterSheriffElection?.()) {
      return {
        summary: { speeches, selfDestructBy: null },
        interrupted: false,
      };
    }
    const speakerDirection = await chooseSpeakerDirection({
      world: this.world,
      events: this.events,
      toolGateway: this.toolGateway,
      actionProvider,
      day: options.day,
      enableSheriff: config.enableSheriff,
    });

    if (config.hooks.onDaybreak && isSelfDestructWindowEnabled(config, ActionWindow.OnDaybreak)) {
      const exploded = await this.selfDestructWindow.execute(requests, actionProvider, ActionWindow.OnDaybreak, Phase.Day);
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

    if (config.hooks.onPreElection && isSelfDestructWindowEnabled(config, ActionWindow.OnPreElection)) {
      const exploded = await this.selfDestructWindow.execute(requests, actionProvider, ActionWindow.OnPreElection, Phase.Day);
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

    const speakers = buildSpeakerOrder(
      this.world,
      this.world.getAliveEntityIds(),
      findSheriffId(this.world),
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

      if (config.hooks.onPerSpeechGap && isSelfDestructWindowEnabled(config, ActionWindow.OnPerSpeechGap)) {
        const exploded = await this.selfDestructWindow.execute(requests, actionProvider, ActionWindow.OnPerSpeechGap, Phase.Day);
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


  /**
   * 判断目标玩家是否存活。
   */
  private isAlive(entityId: EntityId): boolean {
    const alive = this.world.getComponent<AliveComponent>(entityId, COMPONENT.Alive);
    return alive?.alive === true;
  }
}
