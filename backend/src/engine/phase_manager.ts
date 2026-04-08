import {
  ActionProvider,
  BoardConfig,
  EntityId,
  GameEvent,
  GameResult,
  Phase,
  RuntimeSnapshot,
  StatusMark,
} from "../domain/model";
import { ConditionRegistry } from "../domain/registries/condition_registry";
import { DamageResolutionSystem } from "../domain/systems/damage_resolution_system";
import { World } from "../domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { EventRegistry } from "./event_registry";
import { DayPipeline } from "./phase_pipeline/day_pipeline";
import { NightPipeline } from "./phase_pipeline/night_pipeline";
import { VotingPipeline } from "./phase_pipeline/voting_pipeline";
import { RoleRegistry } from "../domain/registries/role_registry";
import { COMPONENT } from "../domain/components/names";
import { BadgeComponent } from "../domain/components/badge";
import { VotingRightComponent } from "../domain/components/voting_right";

/**
 * PhaseManager 是 V3 引擎的时序中枢。
 * 负责串行驱动夜晚/白天/投票，并在每个阶段后执行死亡钩子与胜负裁决。
 */
export class PhaseManager {
  private readonly events: GameEvent[] = [];
  private readonly eventRegistry: EventRegistry;
  private readonly nightPipeline: NightPipeline;
  private readonly dayPipeline: DayPipeline;
  private readonly votingPipeline: VotingPipeline;

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
    this.nightPipeline = new NightPipeline(
      world,
      roleRegistry,
      toolGateway,
      damageResolutionSystem,
      this.events,
    );
    this.dayPipeline = new DayPipeline(world, toolGateway, this.events);
    this.votingPipeline = new VotingPipeline(
      world,
      toolGateway,
      this.eventRegistry,
      this.events,
    );
  }

  getSnapshot(): RuntimeSnapshot {
    return { ...this.state };
  }

  getEvents(): GameEvent[] {
    return [...this.events];
  }

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
      this.setPhase(Phase.GameOver);
      this.state.result = {
        winner: null,
        reason: "max_days_reached",
      };
      return this.getSnapshot();
    }

    this.setPhase(Phase.Night);
    const night = await this.nightPipeline.execute(this.config, actionProvider);
    await this.processDeaths(
      night.damage.deaths,
      night.damage.deathSources,
      actionProvider,
      Phase.Night,
    );

    if (this.checkAndSealResult()) {
      return this.getSnapshot();
    }

    this.setPhase(Phase.Day);
    const dayResult = await this.dayPipeline.execute(this.config, actionProvider);
    if (dayResult.interrupted) {
      // 白天被自爆中断时直接结束当日并切到下一夜。
      if (this.checkAndSealResult()) {
        return this.getSnapshot();
      }
      this.state.day += 1;
      return this.getSnapshot();
    }

    this.setPhase(Phase.Voting);
    const votingResult = await this.votingPipeline.execute(this.config, actionProvider);

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
  ): Promise<void> {
    const seen = new Set<EntityId>(deadIds);
    let pending = [...seen];
    const allSources: Record<number, StatusMark[]> = { ...sources };

    while (pending.length > 0) {
      // 先处理警长死亡带来的警徽逻辑，再执行角色死亡钩子。
      for (const deadId of pending) {
        this.handleSheriffDeath(deadId, phase);
      }

      const result = await this.eventRegistry.onDeath(
        this.world,
        pending,
        allSources,
        async (hunterId) => {
          const action = await actionProvider.getAction({
            phase,
            actorId: hunterId,
            allowedTools: ["shoot"],
            context: {
              trigger: "on_death",
            },
          });
          if (action?.name !== "shoot") {
            return null;
          }

          const validated = this.toolGateway.validateAndSanitize(
            this.world,
            hunterId,
            action,
            {
              phase,
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
    }
  }

  private checkAndSealResult(): boolean {
    const result = this.conditionRegistry.evaluate(this.world, this.config.winCondition);
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

  debugResult(): GameResult | null {
    return this.state.result;
  }

  private setPhase(phase: Phase): void {
    const previous = this.state.phase;
    this.state.phase = phase;
    if (previous === phase) {
      return;
    }
    this.events.push({
      timestamp: Date.now(),
      type: "phase_changed",
      payload: {
        phase,
        day: this.state.day,
      },
    });
  }

  private handleSheriffDeath(entityId: EntityId, phase: Phase): void {
    const badge = this.world.getComponent<BadgeComponent>(entityId, COMPONENT.Badge);
    if (!badge?.isSheriff) {
      return;
    }

    // 当前实现选择“警长死亡后警徽直接销毁”。
    // 若后续引入移交流程，可在此扩展“移交候选 -> 确认 -> 广播”逻辑。
    badge.isSheriff = false;
    badge.destroyed = true;

    const voting = this.world.getComponent<VotingRightComponent>(
      entityId,
      COMPONENT.VotingRight,
    );
    if (voting) {
      voting.weight = 0;
    }

    this.events.push({
      timestamp: Date.now(),
      type: "sheriff_badge_destroyed",
      payload: {
        targetId: entityId,
        reason: `${phase}_death`,
      },
    });
  }
}
