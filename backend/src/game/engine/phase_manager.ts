import {
  ActionProvider,
  BoardConfig,
  EntityId,
  GameEvent,
  GameResult,
  Phase,
  RuntimeSnapshot,
  StatusMark,
  WinCondition,
} from "../../core/domain/model";
import { ConditionRegistry } from "../../core/domain/registries/condition_registry";
import { DamageResolutionSystem } from "../../core/domain/systems/damage_resolution_system";
import { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import {
  getDefaultLastWordsMechanism,
  getDefaultSheriffMechanism,
  LastWordsMechanism,
  SheriffMechanism,
} from "../mechanisms";
import { EventRegistry } from "./event_registry";
import { DayPipeline } from "./phase_pipeline/day_pipeline";
import { NightPipeline } from "./phase_pipeline/night_pipeline";
import { VotingPipeline } from "./phase_pipeline/voting_pipeline";
import { RoleRegistry } from "../../core/domain/registries/role_registry";
import { COMPONENT } from "../../core/domain/components/names";
import { VotingRightComponent } from "../../core/domain/components/voting_right";
import { IdentityComponent } from "../../core/domain/entities/player";
import { RoleComponent } from "../../core/domain/components/role";
import { AliveComponent } from "../../core/domain/components/alive";
import { GameActionRequestFactory } from "./action_request_factory";

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
  private readonly sheriffMechanism: SheriffMechanism;
  private readonly lastWordsMechanism: LastWordsMechanism;

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
  ) {
    this.eventRegistry = new EventRegistry();
    this.sheriffMechanism = getDefaultSheriffMechanism();
    this.lastWordsMechanism = getDefaultLastWordsMechanism();
    this.nightPipeline = new NightPipeline({
      world,
      toolGateway,
      damageResolutionSystem,
      events: this.events,
    });
    this.dayPipeline = new DayPipeline({
      world,
      roleRegistry,
      toolGateway,
      events: this.events,
      sheriffMechanism: this.sheriffMechanism,
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
            name: identity?.name ?? `玩家${id}`,
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
    if (!firstDaySheriffBeforeNightInfo) {
      this.emitNightResolved(night.summary.deaths);
      await this.processDeaths(
        night.damage.deaths,
        night.damage.deathSources,
        actionProvider,
        Phase.Night,
        Phase.Day,
      );
      if (this.checkAndSealResult()) {
        return this.getSnapshot();
      }
    }

    const dayResult = await this.dayPipeline.execute(
      this.config,
      actionProvider,
      firstDaySheriffBeforeNightInfo
        ? {
            day: this.state.day,
            afterSheriffElection: async () => {
              this.emitNightResolved(night.summary.deaths);
              await this.processDeaths(
                night.damage.deaths,
                night.damage.deathSources,
                actionProvider,
                Phase.Night,
                Phase.Day,
              );
            },
          }
        : { day: this.state.day },
    );

    if (firstDaySheriffBeforeNightInfo && this.checkAndSealResult()) {
      return this.getSnapshot();
    }
    if (dayResult.interrupted) {
      // 白天被自爆中断时直接结束当日并切到下一夜。
      if (this.checkAndSealResult()) {
        return this.getSnapshot();
      }
      this.state.day += 1;
      return this.getSnapshot();
    }

    this.setPhase(Phase.Voting);
    const votingResult = await this.votingPipeline.execute(
      this.config,
      actionProvider,
      { day: this.state.day },
    );

    if (votingResult.interrupted) {
      // 投票前窗口发生自爆，同样跳过当日剩余流程。
      if (this.checkAndSealResult()) {
        return this.getSnapshot();
      }
      this.state.day += 1;
      return this.getSnapshot();
    }

    if (votingResult.removed.length > 0) {
      const sources: Record<number, StatusMark[]> = {};
      for (const removedId of votingResult.removed) {
        sources[removedId] = [];
      }
      await this.processDeaths(
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

  private async processDeaths(
    deadIds: EntityId[],
    sources: Record<number, StatusMark[]>,
    actionProvider: ActionProvider,
    phase: Phase,
    lastWordsPhase: Phase,
  ): Promise<void> {
    const seen = new Set<EntityId>(deadIds);
    let pending = [...seen];
    const allSources: Record<number, StatusMark[]> = { ...sources };
    let firstBatch = true;
    const requests = new GameActionRequestFactory(
      this.world,
      this.events,
      this.state.day,
    );

    while (pending.length > 0) {
      this.markPlayersDead(pending);
      if (firstBatch) {
        this.lastWordsMechanism.recordLastWordsGranted(
          this.world,
          pending,
          phase,
          lastWordsPhase,
          this.state.day,
          this.events,
        );
        await this.collectLastWords(pending, lastWordsPhase, phase, actionProvider);
      }

      // 先处理警长死亡带来的警徽逻辑，再执行角色死亡钩子。
      for (const deadId of pending) {
        this.handleSheriffDeath(deadId, phase);
      }

      const result = await this.eventRegistry.onDeath(
        this.world,
        pending,
        allSources,
        async (hunterId) => {
          const actionPhase = this.state.phase;
          const action = await actionProvider.getAction(requests.create({
            phase: actionPhase,
            actorId: hunterId,
            allowedTools: ["shoot"],
            stage: "hunter_shot",
            requiresAction: true,
            summary: "死亡开枪阶段必须完成一次开枪动作。",
            context: {
              trigger: "on_death",
            },
          }));
          if (action?.name !== "shoot") {
            return null;
          }

          const validated = this.toolGateway.validateAndSanitize(
            this.world,
            hunterId,
            action,
            {
              phase: actionPhase,
              allowDeadHunterShoot: true,
            },
          );
          if (!validated.ok || !validated.sanitizedCall) {
            return null;
          }
          return validated.sanitizedCall.args.target_id;
        },
        this.events,
      );

      pending = result.extraDeaths.filter((id) => !seen.has(id));
      for (const id of result.extraDeaths) {
        seen.add(id);
        allSources[id] = result.extraDeathSources[id] ?? [];
      }
      firstBatch = false;
    }
  }

  private async collectLastWords(
    deadIds: EntityId[],
    phase: Phase,
    deathPhase: Phase,
    actionProvider: ActionProvider,
  ): Promise<void> {
    if (!this.lastWordsMechanism.shouldGrantLastWords(deathPhase, this.state.day)) {
      return;
    }
    const requests = new GameActionRequestFactory(
      this.world,
      this.events,
      this.state.day,
    );
    for (const deadId of deadIds) {
      const action = await actionProvider.getAction(requests.create({
        phase,
        actorId: deadId,
        allowedTools: ["speak"],
        stage: "last_words",
        requiresAction: true,
        summary: "遗言阶段必须完成一次发言动作。",
        context: {
          trigger: "last_words",
          death_phase: phase,
        },
      }));
      if (action?.name !== "speak") {
        continue;
      }
      const validated = this.toolGateway.validateAndSanitize(
        this.world,
        deadId,
        action,
        {
          phase,
          allowDeadLastWords: true,
        },
      );
      if (!validated.ok || !validated.sanitizedCall) {
        continue;
      }
      this.events.push({
        timestamp: Date.now(),
        type: "last_words_spoken",
        payload: {
          playerId: deadId,
          phase,
          day: this.state.day,
          text: validated.sanitizedCall.args.text,
        },
      });
    }
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

  /**
   * 处理警长死亡时的警徽流转或撕毁逻辑。
   */
  private handleSheriffDeath(entityId: EntityId, phase: Phase): void {
    this.sheriffMechanism.handleSheriffDeath(
      this.world,
      entityId,
      phase,
      this.events,
    );
  }

  /**
   * 将待结算死亡名单真正写入存活状态。
   */
  private markPlayersDead(playerIds: EntityId[]): void {
    for (const id of playerIds) {
      const alive = this.world.getComponent<AliveComponent>(id, COMPONENT.Alive);
      if (!alive) {
        continue;
      }
      alive.alive = false;
    }
  }
}
