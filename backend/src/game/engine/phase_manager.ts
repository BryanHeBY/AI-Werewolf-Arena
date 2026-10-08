import { text } from "@ai-werewolf-arena/game-text";
import {
  ActionProvider,
  ActionWindow,
  BoardConfig,
  EntityId,
  GameEvent,
  GameResult,
  Phase,
  RuntimeSnapshot,
  DeathCause,
  type DeathSources,
  WinCondition,
} from "../../core/domain/model";
import { ConditionRegistry } from "../../core/domain/registries/condition_registry";
import { DamageResolutionSystem } from "../../core/domain/systems/damage_resolution_system";
import { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { findSheriffId } from "../mechanisms/sheriff/badge";
import { DeathResolution } from "./death_resolution";
import { EventRegistry } from "./event_registry";
import { DayPipeline } from "./phase_pipeline/day_pipeline";
import { NightPipeline } from "./phase_pipeline/night_pipeline";
import { VotingPipeline } from "./phase_pipeline/voting_pipeline";
import { RoleRegistry } from "../../core/domain/registries/role_registry";
import { COMPONENT } from "../../core/domain/components/names";
import { VotingRightComponent } from "../../core/domain/components/voting_right";
import { IdentityComponent } from "../../core/domain/entities/player";
import { RoleComponent } from "../../core/domain/components/role";
import { createRandom, type RandomSource } from "../../core/domain/random";

/**
 * PhaseManager 是游戏引擎的时序中枢。
 * 负责串行驱动夜晚/白天/投票，并在每个阶段后执行死亡钩子与胜负裁决。
 */
export class PhaseManager {
  private readonly events: GameEvent[] = [];
  private readonly eventRegistry: EventRegistry;
  private readonly nightPipeline: NightPipeline;
  private readonly dayPipeline: DayPipeline;
  private readonly votingPipeline: VotingPipeline;
  private readonly deathResolution: DeathResolution;

  private state: RuntimeSnapshot = {
    day: 1,
    phase: Phase.Night,
    gameOver: false,
    result: null,
  };

  constructor(
    private readonly world: World,
    private readonly config: BoardConfig,
    private readonly toolGateway: ToolGateway,
    private readonly roleRegistry: RoleRegistry,
    private readonly conditionRegistry: ConditionRegistry,
    private readonly damageResolutionSystem: DamageResolutionSystem,
    random: RandomSource = createRandom(),
  ) {
    this.eventRegistry = new EventRegistry();
    this.deathResolution = new DeathResolution(world, this.events, toolGateway, this.eventRegistry, this.state);
    this.nightPipeline = new NightPipeline({
      world,
      toolGateway,
      damageResolutionSystem,
      events: this.events,
      random: random.fork("night"),
    });
    this.dayPipeline = new DayPipeline({
      world,
      roleRegistry,
      toolGateway,
      events: this.events,
    });
    this.votingPipeline = new VotingPipeline({
      world,
      roleRegistry,
      toolGateway,
      eventRegistry: this.eventRegistry,
      events: this.events,
    });
    // 仅上帝可见：开局完整牌面信息（玩家身份与阵营映射）。
    this.events.push({
      timestamp: Date.now(),
      type: "god_private_game_info",
      payload: {
        boardSize: this.config.boardSize,
        players: this.world.getAliveEntityIds().map((id) => {
          const identity = this.world.getComponent<IdentityComponent>(
            id,
            COMPONENT.Identity,
          );
          const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
          return {
            id,
            seat: identity?.seat ?? id,
            name: identity?.name ?? text(this.world.locale, "common.player_name", { id }),
            role: role?.role ?? "unknown",
            camp: role?.camp ?? "unknown",
          };
        }),
      },
    });
    // 初始阶段也写入上帝公开广播，确保首轮请求前玩家可见当前阶段。
    this.events.push({
      timestamp: Date.now(),
      type: "phase_changed",
      payload: {
        phase: Phase.Night,
        day: this.state.day,
      },
    });
    const initialSheriffId = findSheriffId(this.world);
    if (initialSheriffId !== null) {
      this.events.push({
        timestamp: Date.now(),
        type: "sheriff_elected",
        payload: {
          winnerId: initialSheriffId,
          source: "initial_configuration",
        },
      });
    }
  }

  /**
   * 获取当前运行时快照（浅拷贝）。
   */
  getSnapshot(): RuntimeSnapshot {
    return { ...this.state };
  }

  /**
   * 获取当前累计事件列表（浅拷贝）。
   */
  getEvents(): GameEvent[] {
    return [...this.events];
  }

  /**
   * 手动跳转阶段（主要用于中断流程控制）。
   */
  jumpTo(phase: Phase): void {
    this.setPhase(phase);
  }

  async runSingleCycle(
    actionProvider: ActionProvider,
    maxDays: number = 20,
  ): Promise<RuntimeSnapshot> {
    if (this.state.gameOver) {
      return this.getSnapshot();
    }

    if (this.state.day > maxDays) {
      this.state.gameOver = true;
      this.state.result = {
        winner: null,
        reason: "max_days_reached",
      };
      this.setPhase(Phase.GameOver);
      return this.getSnapshot();
    }

    this.setPhase(Phase.Night);
    const night = await this.nightPipeline.execute(
      this.config,
      actionProvider,
      this.state.day,
    );
    const firstDaySheriffBeforeNightInfo =
      this.state.day === 1 && this.config.enableSheriff === true;

    this.setPhase(Phase.Day);
    const cycleDay = this.state.day;
    const dayIsCurrent = () => this.state.day === cycleDay && this.state.phase === Phase.Day && !this.state.gameOver;
    let nightSettled = false;
    const settleNight = async (explodedId?: EntityId) => {
      if (nightSettled) return this.state.gameOver;
      nightSettled = true;
      this.emitNightResolved(night.summary.deaths);
      const sources: DeathSources = structuredClone(night.damage.deathSources);
      const deaths = [...night.damage.deaths];
      const deathPhases: Record<EntityId, Phase> = {};
      if (explodedId !== undefined) {
        if (!deaths.includes(explodedId)) deaths.push(explodedId);
        sources[explodedId] = [...new Set([...(sources[explodedId] ?? []), DeathCause.SelfDestruct])];
        deathPhases[explodedId] = Phase.Day;
      }
      await this.deathResolution.resolve(deaths, sources, actionProvider, Phase.Night, Phase.Day, deathPhases);
      if (!dayIsCurrent()) return this.state.gameOver;
      return this.checkAndSealResult();
    };
    if (!firstDaySheriffBeforeNightInfo && await settleNight()) return this.getSnapshot();

    const dayResult = await this.dayPipeline.execute(this.config, actionProvider, {
      day: cycleDay,
      isCurrent: dayIsCurrent,
      commitSelfDestruct: async (id, window) => {
        if (!dayIsCurrent()) return;
        this.recordSelfDestruct(id, window);
        if (!nightSettled) await settleNight(id);
        else await this.deathResolution.resolve([id], { [id]: [DeathCause.SelfDestruct] }, actionProvider, Phase.Day, Phase.Day);
      },
      ...(firstDaySheriffBeforeNightInfo ? { afterSheriffElection: () => settleNight() } : {}),
    });

    if (this.state.gameOver || !dayIsCurrent()) return this.getSnapshot();
    if (dayResult.interrupted) {
      // 白天被自爆中断时直接结束当日并切到下一夜。
      if (this.state.gameOver || this.checkAndSealResult()) {
        return this.getSnapshot();
      }
      this.state.day += 1;
      this.setPhase(Phase.Night);
      return this.getSnapshot();
    }

    this.setPhase(Phase.Voting);
    const votingIsCurrent = () => this.state.day === cycleDay && this.state.phase === Phase.Voting && !this.state.gameOver;
    const votingResult = await this.votingPipeline.execute(
      this.config,
      actionProvider,
      { day: cycleDay, isCurrent: votingIsCurrent, commitSelfDestruct: async id => {
        if (!votingIsCurrent()) return;
        this.recordSelfDestruct(id, ActionWindow.OnPreVote);
        await this.deathResolution.resolve([id], { [id]: [DeathCause.SelfDestruct] }, actionProvider, Phase.Voting, Phase.Voting);
      } },
    );

    if (!votingIsCurrent()) return this.getSnapshot();
    if (votingResult.interrupted) {
      // 投票前窗口发生自爆，同样跳过当日剩余流程。
      if (this.checkAndSealResult()) {
        return this.getSnapshot();
      }
      this.state.day += 1;
      this.setPhase(Phase.Night);
      return this.getSnapshot();
    }

    if (votingResult.removed.length > 0) {
      const sources: DeathSources = {};
      for (const removedId of votingResult.removed) {
        sources[removedId] = [DeathCause.Exile];
      }
      await this.deathResolution.resolve(
        votingResult.removed,
        sources,
        actionProvider,
        Phase.Voting,
        Phase.Voting,
      );
    }

    if (this.checkAndSealResult()) {
      return this.getSnapshot();
    }

    this.state.day += 1;
    return this.getSnapshot();
  }

  async runUntilGameOver(
    actionProvider: ActionProvider,
    maxDays: number = 20,
  ): Promise<RuntimeSnapshot> {
    while (!this.state.gameOver) {
      await this.runSingleCycle(actionProvider, maxDays);
    }
    return this.getSnapshot();
  }


  /**
   * 检查胜负并在命中时封盘写入 game_over 事件。
   */
  private checkAndSealResult(): boolean {
    const result = this.conditionRegistry.evaluateMany(
      this.world,
      this.resolveWinConditions(),
    );
    if (!result) {
      return false;
    }

    this.state.result = result;
    this.setPhase(Phase.GameOver);
    this.state.gameOver = true;

    this.events.push({
      timestamp: Date.now(),
      type: "game_over",
      payload: {
        winner: result.winner,
        reason: result.reason,
      },
    });

    return true;
  }

  /**
   * 解析板子胜利条件配置，兼容旧字段 winCondition。
   */
  private resolveWinConditions(): WinCondition[] {
    if (Array.isArray(this.config.winConditions) && this.config.winConditions.length > 0) {
      return this.config.winConditions;
    }
    if (this.config.winCondition) {
      return [this.config.winCondition];
    }
    // 兜底：未配置时退回屠城，避免对局无法结束。
    return [WinCondition.SlaughterCity];
  }

  /**
   * 写入夜晚结算公开信息（用于“昨夜死亡/平安夜”广播）。
   */
  private recordSelfDestruct(id: EntityId, window: ActionWindow): void {
    this.events.push({ timestamp: Date.now(), type: "wolf_self_destruct", payload: { wolfId: id, window } });
  }

  private emitNightResolved(deaths: EntityId[]): void {
    this.events.push({
      timestamp: Date.now(),
      type: "night_resolved",
      payload: {
        deaths: [...deaths],
      },
    });
  }

  /**
   * 调试接口：返回当前终局结果。
   */
  debugResult(): GameResult | null {
    return this.state.result;
  }

  /**
   * 切换阶段并写入 `phase_changed` 事件。
   */
  private setPhase(phase: Phase): void {
    const previous = this.state.phase;
    this.state.phase = phase;
    if (previous === phase) {
      return;
    }
    this.world.closeDeathActions();
    const gameOverPayload =
      phase === Phase.GameOver && this.state.result
        ? {
            winner: this.state.result.winner,
            reason: this.state.result.reason,
          }
        : {};
    this.events.push({
      timestamp: Date.now(),
      type: "phase_changed",
      payload: {
        phase,
        day: this.state.day,
        ...gameOverPayload,
      },
    });
  }

}
