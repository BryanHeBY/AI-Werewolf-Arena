/**
 * Runs the daytime speaking pipeline from the current alive seats and provider. Outputs preserve
 * speech, duel/self-destruct interruptions and the returned day result. Inputs use the assembled
 * gateway and role mechanisms; it does not own final phase changes or victory sealing.
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { hasActiveDebate } from "../../mechanisms/roles/debater/authority";
import { DebaterWindow } from "../../mechanisms/roles/debater/window";
import { AliveComponent } from "../../../core/domain/components/alive";
import { COMPONENT } from "../../../core/domain/components/names";
import {
  ActionProvider,
  ActionWindow,
  DaySummary,
  EntityId,
  GameEvent,
  Phase,
  KnightDuelWindow as DuelWindow,
} from "../../../core/domain/model";
import { RoleRegistry } from "../../../core/domain/registries/role_registry";
import { ToolGateway } from "../../gateway/tool_gateway";
import { electSheriffIfNeeded } from "../../mechanisms/sheriff/election";
import { buildSpeakerOrder, chooseSpeakerDirection } from "../../mechanisms/sheriff/speaking_order";
import { findSheriffId } from "../../mechanisms/sheriff/badge";
import { World } from "../../../core/domain/world";
import { GameActionRequestFactory } from "../action_request_factory";
import { SelfDestructWindow, isSelfDestructWindowEnabled } from "../self_destruct_window";
import { KnightDuelWindow } from "../knight_duel_window";

/**
 * 白天流水线执行结果。
 */
export interface DayPipelineResult {
  summary: DaySummary;
  interrupted: boolean;
  selfDestruct?: import("../../../core").SelfDestructSelection;
  duel?: import("../../../core").KnightDuelSelection;
}

export interface DayPipelineOptions {
  /** 当前日次由 PhaseManager 显式传入，不能从事件历史反推。 */
  day: number;
  /** 返回 true 表示已终局，不再请求白天行动。 */
  afterSheriffElection?: () => Promise<boolean>;
  isCurrent?: () => boolean;
  commitSelfDestruct?: (
    choice: import("../../../core").SelfDestructSelection,
    window: ActionWindow,
  ) => Promise<void | boolean>;
  commitKnightDuel?: (
    choice: import("../../../core").KnightDuelSelection,
  ) => Promise<import("../../../core").KnightDuelCommit>;
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
  private readonly knightDuelWindow: KnightDuelWindow;
  private readonly debaterWindow: DebaterWindow;
  constructor(dependencies: DayPipelineDependencies) {
    this.world = dependencies.world;
    this.roleRegistry = dependencies.roleRegistry;
    this.toolGateway = dependencies.toolGateway;
    this.events = dependencies.events;
    this.selfDestructWindow = new SelfDestructWindow(
      this.world,
      this.roleRegistry,
      this.toolGateway,
    );
    this.knightDuelWindow = new KnightDuelWindow(this.world, this.toolGateway);
    this.debaterWindow = new DebaterWindow(this.world, this.toolGateway, this.events);
  }

  async execute(
    config: ReadonlyBoardConfig,
    actionProvider: ActionProvider,
    options: DayPipelineOptions,
  ): Promise<DayPipelineResult> {
    if (hasActiveDebate(this.world)) throw new Error("debate_window_reentry");
    const speeches: DaySummary["speeches"] = [];
    const requests = new GameActionRequestFactory(this.world, this.events, options.day);
    const isCurrent = options.isCurrent ?? (() => true);
    if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
    if (
      options.day === 1 &&
      config.enableSheriff &&
      findSheriffId(this.world) === null &&
      config.hooks.onPreElection &&
      isSelfDestructWindowEnabled(config, ActionWindow.OnPreElection)
    ) {
      const exploded = await this.selfDestructWindow.execute(
        requests,
        actionProvider,
        ActionWindow.OnPreElection,
        Phase.Day,
        isCurrent,
        (id) => options.commitSelfDestruct?.(id, ActionWindow.OnPreElection) ?? Promise.resolve(),
      );
      if (exploded !== null)
        return {
          summary: { speeches, selfDestructBy: exploded.actorId },
          interrupted: true,
          selfDestruct: exploded,
        };
      if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
    }
    await electSheriffIfNeeded({
      world: this.world,
      events: this.events,
      toolGateway: this.toolGateway,
      actionProvider,
      day: options.day,
      enableSheriff: config.enableSheriff,
      config,
      isCurrent,
    });
    if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
    if (await options.afterSheriffElection?.()) {
      return {
        summary: { speeches, selfDestructBy: null },
        interrupted: false,
      };
    }

    if (config.hooks.onDaybreak && isSelfDestructWindowEnabled(config, ActionWindow.OnDaybreak)) {
      const exploded = await this.selfDestructWindow.execute(
        requests,
        actionProvider,
        ActionWindow.OnDaybreak,
        Phase.Day,
        isCurrent,
        (id) => options.commitSelfDestruct?.(id, ActionWindow.OnDaybreak) ?? Promise.resolve(),
      );
      if (exploded !== null) {
        return {
          summary: {
            speeches,
            selfDestructBy: exploded.actorId,
          },
          interrupted: true,
          selfDestruct: exploded,
        };
      }
    }

    if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
    const openingDuel = await this.knightDuelWindow.execute(
      config,
      requests,
      actionProvider,
      DuelWindow.BeforeSpeeches,
      isCurrent,
      options.commitKnightDuel,
    );
    if (openingDuel.endsDay)
      return {
        summary: { speeches, selfDestructBy: null },
        interrupted: true,
        ...(openingDuel.selection ? { duel: openingDuel.selection } : {}),
      };
    if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
    const speakerDirection = await chooseSpeakerDirection({
      world: this.world,
      events: this.events,
      toolGateway: this.toolGateway,
      actionProvider,
      day: options.day,
      enableSheriff: config.enableSheriff,
    });

    const speakers = buildSpeakerOrder(
      this.world,
      this.world.getAliveEntityIds(),
      findSheriffId(this.world),
      speakerDirection,
    );

    for (const actorId of speakers) {
      if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
      if (!this.isAlive(actorId)) {
        continue;
      }

      const debate = await this.debaterWindow.execute(
        config,
        requests,
        actionProvider,
        actorId,
        options.day,
        isCurrent,
      );
      if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
      if (!debate.skipSpeech && this.isAlive(actorId)) {
        const req = requests.create({
          phase: Phase.Day,
          actorId,
          allowedTools: ["speak"],
          stage: "day_speech",
          requiresAction: true,
          summary: { key: "request.summary.day_speech" },
          context: {},
        });

        const action = await actionProvider.getAction(req);
        if (!isCurrent())
          return { summary: { speeches, selfDestructBy: null }, interrupted: false };
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
      }

      if (
        config.hooks.onPerSpeechGap &&
        isSelfDestructWindowEnabled(config, ActionWindow.OnPerSpeechGap)
      ) {
        const exploded = await this.selfDestructWindow.execute(
          requests,
          actionProvider,
          ActionWindow.OnPerSpeechGap,
          Phase.Day,
          isCurrent,
          (id) =>
            options.commitSelfDestruct?.(id, ActionWindow.OnPerSpeechGap) ?? Promise.resolve(),
        );
        if (exploded !== null) {
          return {
            summary: {
              speeches,
              selfDestructBy: exploded.actorId,
            },
            interrupted: true,
            selfDestruct: exploded,
          };
        }
      }
      const gapDuel = await this.knightDuelWindow.execute(
        config,
        requests,
        actionProvider,
        DuelWindow.BetweenSpeeches,
        isCurrent,
        options.commitKnightDuel,
      );
      if (gapDuel.endsDay)
        return {
          summary: { speeches, selfDestructBy: null },
          interrupted: true,
          ...(gapDuel.selection ? { duel: gapDuel.selection } : {}),
        };
    }

    const closingDuel = await this.knightDuelWindow.execute(
      config,
      requests,
      actionProvider,
      DuelWindow.AfterSpeeches,
      isCurrent,
      options.commitKnightDuel,
    );
    if (closingDuel.endsDay)
      return {
        summary: { speeches, selfDestructBy: null },
        interrupted: true,
        ...(closingDuel.selection ? { duel: closingDuel.selection } : {}),
      };

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
    const alive = this.world.getComponent(entityId, COMPONENT.Alive);
    return alive?.alive === true;
  }
}
