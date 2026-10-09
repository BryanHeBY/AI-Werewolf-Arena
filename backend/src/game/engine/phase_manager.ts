import {
  hasActiveThiefSetup,
  hasActiveThiefNight,
  hasThiefNightCommit,
  thiefSetupReady,
  initialThiefDeal,
} from "../mechanisms/roles/thief/deal";
import { ThiefSetupWindow } from "../mechanisms/roles/thief/setup";
import { WallNotesWindow } from "../mechanisms/events/wall_notes/window";
import { hasActiveWall } from "../mechanisms/events/wall_notes/authority";
import { GameActionRequestFactory } from "./action_request_factory";
import { replaceWithFoxVictory } from "../mechanisms/roles/cursed_fox/victory";
import { readGameOutcome, readVictoryPoint } from "@ai-werewolf-arena/replay-contract";
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-catalog";
import { text } from "@ai-werewolf-arena/game-text";
import {
  ActionProvider,
  ActionWindow,
  BoardConfig,
  EntityId,
  GameEvent,
  ExileFeedback,
  GameResult,
  type WinDecision,
  Camp,
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
import { commitSelfDestructSelection } from "../mechanisms/self_destruct/commit";
import { commitKnightDuel } from "../mechanisms/roles/knight/commit";
import { captureExileFeedback } from "../mechanisms/roles/gravekeeper/feedback";
import {
  captureBeautyExile,
  resolveBeautyExileVictory,
  type BeautyExileCandidate,
} from "../mechanisms/roles/wolf_beauty/relation";
import { BearNightFrame } from "../mechanisms/roles/bear/night_frame";
import { refreshHiddenWolfInheritance } from "../mechanisms/roles/hidden_wolf/inheritance";
import { refreshGargoyleInheritance } from "../mechanisms/roles/gargoyle/inheritance";
import { refreshMechanicalInheritance } from "../mechanisms/roles/mechanical_wolf/inheritance";
import { refreshAwakenedInheritance } from "../mechanisms/roles/awakened_hidden_wolf/inheritance";
import { aliveLifeVersion } from "../../core/domain/components/alive";
import { VotingRightComponent } from "../../core/domain/components/voting_right";
import { IdentityComponent } from "../../core/domain/entities/player";
import { RoleComponent } from "../../core/domain/components/role";
import { createRandom, type RandomSource } from "../../core/domain/random";
import { victoryDecision } from "../mechanisms/win_conditions/results";

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
  private previousExile: ExileFeedback | null = null;
  private phaseRevision = 0;

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
    private readonly random: RandomSource = createRandom(),
  ) {
    this.eventRegistry = new EventRegistry();
    this.deathResolution = new DeathResolution(
      world,
      this.events,
      toolGateway,
      this.eventRegistry,
      this.state,
      config,
    );
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
          const identity = this.world.getComponent<IdentityComponent>(id, COMPONENT.Identity);
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
    const initialDeal = initialThiefDeal(this.world);
    if (initialDeal)
      this.events.push({
        timestamp: Date.now(),
        type: "thief_initial_deal",
        payload: {
          policy: "lui_meme_thief_two_extra_villagers_v1",
          roles: [...initialDeal],
          boardSize: this.config.boardSize,
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
    refreshHiddenWolfInheritance(this.world, this.events, this.state.day);
    refreshGargoyleInheritance(this.world, this.events, this.state.day);
    refreshMechanicalInheritance(this.world, this.state.day, this.events);
    refreshAwakenedInheritance(this.world, this.state.day, this.events);
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
    return structuredClone(this.state);
  }

  /**
   * 获取当前累计事件列表（浅拷贝）。
   */
  getEvents(): GameEvent[] {
    return this.events.map((event) => {
      const copy = structuredClone(event);
      if ("audience" in copy) Object.freeze(copy.audience);
      return copy;
    });
  }

  /**
   * 手动跳转阶段（主要用于中断流程控制）。
   */
  jumpTo(phase: Phase): void {
    this.phaseRevision++;
    this.setPhase(phase);
  }

  async runSingleCycle(
    actionProvider: ActionProvider,
    maxDays: number = 20,
  ): Promise<RuntimeSnapshot> {
    if (hasActiveThiefSetup(this.world) || hasActiveThiefNight(this.world))
      throw new Error("thief_setup_reentry");
    if (!this.state.gameOver && hasThiefNightCommit(this.world, this.state.day))
      throw new Error("thief_cycle_reentry_after_night");
    if (hasActiveWall(this.world)) throw new Error("wall_window_reentry");
    if (this.state.gameOver) {
      return this.getSnapshot();
    }

    if (this.state.day > maxDays) {
      this.sealResult(
        { winner: null, reason: "max_days_reached", outcome: { kind: "no_winner" } },
        "max_days_reached",
        Phase.Night,
      );
      return this.getSnapshot();
    }

    this.setPhase(Phase.Night);
    const nightDay = this.state.day,
      nightRevision = this.phaseRevision;
    const nightIsCurrent = () =>
      this.state.day === nightDay &&
      this.state.phase === Phase.Night &&
      !this.state.gameOver &&
      this.phaseRevision === nightRevision;
    if (!thiefSetupReady(this.world)) {
      const ready = await new ThiefSetupWindow(this.world, this.toolGateway, this.events).execute(
        this.config,
        actionProvider,
        nightDay,
        nightIsCurrent,
      );
      if (!ready || !nightIsCurrent()) return this.getSnapshot();
    }
    const bearFrame = BearNightFrame.capture(this.world, nightDay);
    const night = await this.nightPipeline.execute(this.config, actionProvider, this.state.day, {
      previousExile: this.previousExile,
      isCurrent: nightIsCurrent,
    });
    if (night.interrupted || !nightIsCurrent()) return this.getSnapshot();
    const firstDaySheriffBeforeNightInfo =
      this.state.day === 1 && this.config.enableSheriff === true;

    this.setPhase(Phase.Day);
    const cycleDay = this.state.day,
      dayRevision = this.phaseRevision;
    const dayIsCurrent = () =>
      this.state.day === cycleDay &&
      this.state.phase === Phase.Day &&
      !this.state.gameOver &&
      this.phaseRevision === dayRevision;
    let nightSettled = false;
    const settleNight = async (blast?: { deaths: number[]; sources: DeathSources }) => {
      if (nightSettled) return this.state.gameOver;
      nightSettled = true;
      const retainedSources: DeathSources = Object.fromEntries(
        night.damage.deaths.map((id) => [
          id,
          (night.damage.deathSources[id] ?? []).filter(
            (source) =>
              source !== DeathCause.FoxInspection ||
              night.foxInspections?.some(
                (claim) => claim.target.id === id && claim.isTargetCurrent(),
              ),
          ),
        ]),
      );
      const nightDeaths = night.damage.deaths.filter((id) => {
        const scope = night.deathLives.get(id);
        return (
          scope &&
          retainedSources[id]?.length &&
          this.world.getComponent(id, COMPONENT.Alive) === scope.life &&
          scope.life.alive &&
          scope.version !== undefined &&
          aliveLifeVersion(scope.life) === scope.version
        );
      });
      this.emitNightResolved(nightDeaths);
      const sources: DeathSources = Object.fromEntries(
        nightDeaths.map((id) => [id, [...(retainedSources[id] ?? [])]]),
      );
      const deaths = [...nightDeaths];
      const deathPhases: Record<EntityId, Phase> = {};
      if (blast !== undefined) {
        for (const id of blast.deaths) {
          if (!deaths.includes(id)) deaths.push(id);
          sources[id] = [...new Set([...(sources[id] ?? []), ...(blast.sources[id] ?? [])])];
          deathPhases[id] = Phase.Day;
        }
      }
      await this.deathResolution.resolve(
        deaths,
        sources,
        actionProvider,
        Phase.Night,
        Phase.Day,
        deathPhases,
        { dreams: night.dreamFrame, nightOriginIds: nightDeaths, isCurrent: dayIsCurrent },
      );
      if (!dayIsCurrent()) return this.state.gameOver;
      bearFrame?.publish(this.world, this.events, dayIsCurrent);
      return this.checkAndSealResult(blast !== undefined ? "day_interrupted" : "night_settled");
    };
    if (!firstDaySheriffBeforeNightInfo && (await settleNight())) return this.getSnapshot();

    const dayResult = await this.dayPipeline.execute(this.config, actionProvider, {
      day: cycleDay,
      isCurrent: dayIsCurrent,
      commitSelfDestruct: async (choice, window) => {
        if (!dayIsCurrent()) return false;
        // Keep pending night information private; a doomed White Wolf King cannot swallow its death with this skill.
        if (
          !nightSettled &&
          choice.kind === "white_wolf_king" &&
          night.damage.deaths.includes(choice.actorId)
        )
          return false;
        const blast = commitSelfDestructSelection(
          this.world,
          choice,
          window,
          Phase.Day,
          this.events,
        );
        if (!blast) return false;
        if (!nightSettled) await settleNight(blast);
        else
          await this.deathResolution.resolve(
            blast.deaths,
            blast.sources,
            actionProvider,
            Phase.Day,
            Phase.Day,
          );
        return true;
      },
      ...(firstDaySheriffBeforeNightInfo ? { afterSheriffElection: () => settleNight() } : {}),
      commitKnightDuel: async (choice) => {
        if (!dayIsCurrent() || !nightSettled) return "rejected";
        const duel = commitKnightDuel(this.world, choice, Phase.Day, this.events);
        if (!duel) return "rejected";
        await this.deathResolution.resolve(
          duel.deaths,
          duel.sources,
          actionProvider,
          Phase.Day,
          Phase.Day,
        );
        if (!dayIsCurrent()) return "terminal";
        if (this.checkAndSealResult("day_interrupted")) return "terminal";
        return duel.endsDay ? "night" : "continue";
      },
    });

    if (this.state.gameOver || !dayIsCurrent()) return this.getSnapshot();
    if (dayResult.interrupted) {
      // 白天被自爆中断时直接结束当日并切到下一夜。
      if (this.state.gameOver || this.checkAndSealResult("day_interrupted")) {
        return this.getSnapshot();
      }
      this.state.day += 1;
      this.setPhase(Phase.Night);
      return this.getSnapshot();
    }

    this.setPhase(Phase.Voting);
    const votingRevision = this.phaseRevision;
    const votingIsCurrent = () =>
      this.state.day === cycleDay &&
      this.state.phase === Phase.Voting &&
      !this.state.gameOver &&
      this.phaseRevision === votingRevision;
    const votingResult = await this.votingPipeline.execute(this.config, actionProvider, {
      day: cycleDay,
      isCurrent: votingIsCurrent,
      commitSelfDestruct: async (choice) => {
        if (!votingIsCurrent()) return false;
        const blast = commitSelfDestructSelection(
          this.world,
          choice,
          ActionWindow.OnPreVote,
          Phase.Voting,
          this.events,
        );
        if (!blast) return false;
        await this.deathResolution.resolve(
          blast.deaths,
          blast.sources,
          actionProvider,
          Phase.Voting,
          Phase.Voting,
          {},
          { isCurrent: votingIsCurrent },
        );
        return true;
      },
    });

    if (!votingIsCurrent()) return this.getSnapshot();
    if (votingResult.interrupted) {
      // 投票前窗口发生自爆，同样跳过当日剩余流程。
      if (this.checkAndSealResult("day_interrupted")) {
        return this.getSnapshot();
      }
      this.state.day += 1;
      this.setPhase(Phase.Night);
      return this.getSnapshot();
    }

    let beautyCandidate: BeautyExileCandidate | null = null;
    if (votingResult.removed.length > 0) {
      const target = votingResult.summary.target;
      if (target !== null && votingResult.removed.includes(target))
        beautyCandidate = captureBeautyExile(this.world, target);
      this.previousExile =
        target !== null && votingResult.removed.includes(target)
          ? captureExileFeedback(this.world, target, cycleDay)
          : null;
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
        {},
        { isCurrent: votingIsCurrent },
      );
    }
    if (!votingIsCurrent()) return this.getSnapshot();
    const beautyResult = resolveBeautyExileVictory(this.world, beautyCandidate);
    if (
      this.checkAndSealResult(
        "exile_settled",
        beautyResult ? { [WinCondition.SlaughterSide]: beautyResult } : {},
      )
    ) {
      return this.getSnapshot();
    }

    await new WallNotesWindow(this.world, this.toolGateway, this.events).execute(
      this.config,
      new GameActionRequestFactory(this.world, this.events, cycleDay),
      actionProvider,
      cycleDay,
      votingIsCurrent,
      () => this.random.fork("wall_notes"),
    );
    if (!votingIsCurrent()) return this.getSnapshot();
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
  private checkAndSealResult(
    checkpoint: VictoryCheckpoint,
    overrides: Partial<Record<WinCondition, WinDecision>> = {},
  ): boolean {
    if (this.state.gameOver) return true;
    const result = this.conditionRegistry.evaluateMany(
      this.world,
      this.resolveWinConditions(),
      checkpoint,
      overrides,
    );
    if (!result) return false;
    this.sealResult(replaceWithFoxVictory(this.world, result), checkpoint, this.state.phase);
    return true;
  }

  private sealResult(decision: WinDecision, checkpoint: VictoryCheckpoint, phase: Phase): void {
    if (this.state.gameOver) return;
    const outcome = readGameOutcome(decision.outcome, this.world.entityIds());
    const winner =
      outcome.kind === "victory" && outcome.primary.kind === "faction"
        ? (outcome.primary.faction as Camp)
        : null;
    if (
      winner !== decision.winner ||
      typeof decision.reason !== "string" ||
      decision.reason.length === 0
    )
      throw new Error("game_result_invalid");
    if (outcome.kind === "victory") {
      const targets = [outcome.primary, ...outcome.additional].map(
        ({ winningPlayerIds: _ids, ...target }) => target,
      );
      const expected = victoryDecision(
        this.world,
        targets[0],
        decision.reason,
        targets.slice(1),
      ).outcome;
      if (JSON.stringify(expected) !== JSON.stringify(outcome))
        throw new Error("game_result_membership_invalid");
    }
    const decidedAt = readVictoryPoint({ day: this.state.day, phase, checkpoint });
    this.state.result = { winner, reason: decision.reason, outcome, decidedAt };
    this.state.gameOver = true;
    this.setPhase(Phase.GameOver);
    this.events.push({
      timestamp: Date.now(),
      type: "game_over",
      payload: structuredClone(this.state.result),
    });
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
    return this.state.result === null ? null : structuredClone(this.state.result);
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
    this.phaseRevision++;
    this.world.closeDeathActions();
    const gameOverPayload =
      phase === Phase.GameOver && this.state.result
        ? {
            winner: this.state.result.winner,
            reason: this.state.result.reason,
            outcome: structuredClone(this.state.result.outcome),
            decidedAt: { ...this.state.result.decidedAt },
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
