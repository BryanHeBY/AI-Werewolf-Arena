/**
 * 负责从当前存活席位和 Provider 推进白天警长、普通发言与中断检查点。输入为已装配
 * World、网关和配置，输出为原发言摘要及中断结果；具体窗口构造与重入政策归规则组合。
 * 发言前后仍按原位置复查当前性与存活，窗口结果不代替死亡提交、最终阶段变化或判胜。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { announceSilenceDay, replaceSilencedSpeech } from "../../rulesets/silence-expression-plan";
import { createDaytimeInterruptionComposition } from "../../rulesets/daytime-interruption-composition";
import type { DaytimeInterruptionComposition } from "../daytime-interruption-contracts";
import { AliveComponent } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import {
  ActionProvider,
  ActionWindow,
  DaySummary,
  EntityId,
  GameEvent,
  Phase,
  KnightDuelWindow as DuelWindow,
} from "../../domain/model";
import { RoleRegistry } from "../../domain/registries/role-registry";
import { ToolGateway } from "../actions/tool-gateway";
import { electSheriffIfNeeded } from "../../features/sheriff/election-ports";
import {
  buildSpeakerOrder,
  chooseSpeakerDirection,
} from "../../features/sheriff/speaking-order-ports";
import { findSheriffId } from "../../features/sheriff/badge-ports";
import { World } from "../../domain/world";
import { GameActionRequestFactory } from "../actions/action-request-factory";
import { isSelfDestructWindowEnabled } from "../../rulesets/self-destruct-window";
import { types } from "node:util";

/**
 * 白天流水线执行结果。
 */
export interface DayPipelineResult {
  summary: DaySummary;
  interrupted: boolean;
  selfDestruct?: import("../../domain").SelfDestructSelection;
  duel?: import("../../domain").KnightDuelSelection;
}

export interface DayPipelineOptions {
  /** 只有真实阶段owner的自有数据回调接入；输出只请求恢复游标或跳夜，不授阶段写权。 */
  awakenedBoundary?: (identity: object) => Promise<"resumeDay" | "nextNight">;
  /** 当前日次由 PhaseManager 显式传入，不能从事件历史反推。 */
  day: number;
  /** 返回 true 表示已终局，不再请求白天行动。 */
  afterSheriffElection?: () => Promise<boolean>;
  isCurrent?: () => boolean;
  commitSelfDestruct?: (
    choice: import("../../domain").SelfDestructSelection,
    window: ActionWindow,
  ) => Promise<void | boolean>;
  commitKnightDuel?: (
    choice: import("../../domain").KnightDuelSelection,
  ) => Promise<import("../../domain").KnightDuelCommit>;
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
  private readonly interruptions: DaytimeInterruptionComposition;
  constructor(dependencies: DayPipelineDependencies) {
    this.world = dependencies.world;
    this.roleRegistry = dependencies.roleRegistry;
    this.toolGateway = dependencies.toolGateway;
    this.events = dependencies.events;
    this.interruptions = createDaytimeInterruptionComposition({
      world: () => this.world,
      roleRegistry: () => this.roleRegistry,
      toolGateway: () => this.toolGateway,
      events: () => this.events,
    });
  }

  async execute(
    config: ReadonlyBoardConfig,
    actionProvider: ActionProvider,
    options: DayPipelineOptions,
  ): Promise<DayPipelineResult> {
    this.interruptions.assertEntry();
    const speeches: DaySummary["speeches"] = [];
    const requests = new GameActionRequestFactory(this.world, this.events, options.day);
    const isCurrent = options.isCurrent ?? (() => true);
    const ownedBoundary = types.isProxy(options)
        ? undefined
        : Object.getOwnPropertyDescriptor(options, "awakenedBoundary"),
      awaken =
        ownedBoundary && "value" in ownedBoundary
          ? (ownedBoundary.value as DayPipelineOptions["awakenedBoundary"])
          : undefined;
    if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
    if (
      options.day === 1 &&
      config.enableSheriff &&
      findSheriffId(this.world) === null &&
      config.hooks.onPreElection &&
      isSelfDestructWindowEnabled(config, ActionWindow.OnPreElection)
    ) {
      const exploded = await this.interruptions.selfDestruct.execute(
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
      // 这里只捕获读取闭包；选举在原名单准备后才读取该真实构造器并 new 自己的实例。
      get requestFactory() {
        return GameActionRequestFactory;
      },
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
      const exploded = await this.interruptions.selfDestruct.execute(
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
    const openingDuel = await this.interruptions.duel.execute(
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
      // 方向窗口拥有独立工厂寿命，未启用／无持徽者不会触发此 getter。
      get requestFactory() {
        return GameActionRequestFactory;
      },
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

    if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
    announceSilenceDay(config, this.world, this.events, options.day, isCurrent);
    if (awaken && (await awaken(Object.freeze({}))) === "nextNight")
      return { summary: { speeches, selfDestructBy: null }, interrupted: true };
    for (const actorId of speakers) {
      if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
      if (!this.isAlive(actorId)) {
        continue;
      }

      // 辩论可能令原演员出局或跳过发言；返回后仍复查，不跳过该席位的后续间隙。
      const debate = await this.interruptions.debate.execute(
        config,
        requests,
        actionProvider,
        actorId,
        options.day,
        isCurrent,
      );
      if (!isCurrent()) return { summary: { speeches, selfDestructBy: null }, interrupted: false };
      if (!debate.skipSpeech && this.isAlive(actorId)) {
        const expression = replaceSilencedSpeech(
          config,
          {
            world: this.world,
            events: this.events,
            requests,
            provider: actionProvider,
            gateway: this.toolGateway,
            day: options.day,
            phase: Phase.Day,
            isCurrent,
          },
          actorId,
          "day",
        );
        if (expression) {
          await expression;
          if (!isCurrent())
            return { summary: { speeches, selfDestructBy: null }, interrupted: false };
        } else {
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
      }

      if (
        config.hooks.onPerSpeechGap &&
        isSelfDestructWindowEnabled(config, ActionWindow.OnPerSpeechGap)
      ) {
        const exploded = await this.interruptions.selfDestruct.execute(
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
      const gapDuel = await this.interruptions.duel.execute(
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
      if (awaken && (await awaken(Object.freeze({}))) === "nextNight")
        return { summary: { speeches, selfDestructBy: null }, interrupted: true };
    }

    const closingDuel = await this.interruptions.duel.execute(
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
    if (awaken && (await awaken(Object.freeze({}))) === "nextNight")
      return { summary: { speeches, selfDestructBy: null }, interrupted: true };

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
