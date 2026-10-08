import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { StatusMarksComponent } from "../../../core/domain/components/status_marks";
import {
  ActionProvider,
  ActionRequest,
  ActionRequestExtras,
  ActionStage,
  BoardConfig,
  EntityId,
  GameEvent,
  ExileFeedback,
  NightSummary,
  Phase,
  Role,
  TieBreakerStrategy,
} from "../../../core/domain/model";
import {
  DamageResolutionResult,
  DamageResolutionSystem,
} from "../../../core/domain/systems/damage_resolution_system";
import { World } from "../../../core/domain/world";
import { ToolGateway } from "../../gateway/tool_gateway";
import {
  getDefaultNightStageRegistry,
  NightStageRegistry,
  NightStageState,
} from "../../mechanisms";
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import { GameActionRequestFactory } from "../action_request_factory";
import { createRandom, shuffled, type RandomSource } from "../../../core/domain/random";
import { DreamNightFrame, hasDreamNightCommit } from "../../mechanisms/roles/dreamer/night_frame";
import {discardStaleWolfKnife} from "../../mechanisms/roles/wolf/knife_scope";
import {hasRoleInspectionNightCommit} from "../../mechanisms/roles/role_inspection/night_scope";
import {AliveComponent,aliveLifeVersion} from "../../../core/domain/components/alive";

export interface NightPipelineDependencies {
  world: World;
  toolGateway: ToolGateway;
  damageResolutionSystem: DamageResolutionSystem;
  events: GameEvent[];
  stageRegistry?: NightStageRegistry;
  random?: RandomSource;
}

export interface NightPipelineOptions {
  previousExile?: Readonly<ExileFeedback> | null;
  isCurrent?: () => boolean;
}
export type NightPipelineResult =
  | { interrupted: false; summary: NightSummary; damage: DamageResolutionResult; dreamFrame: DreamNightFrame; deathLives:ReadonlyMap<EntityId,{life:AliveComponent;version:number|undefined}> }
  | { interrupted: true };

/**
 * 夜间阶段流水线：
 * - 通过 NightStageRegistry 串行驱动夜间子阶段；
 * - 最后统一执行伤害结算并返回结果。
 * night_resolved 事件由 PhaseManager 按白天流程时序写入。
 */
export class NightPipeline {
  private readonly world: World;
  private readonly toolGateway: ToolGateway;
  private readonly damageResolutionSystem: DamageResolutionSystem;
  private readonly events: GameEvent[];
  private readonly stageRegistry: NightStageRegistry;
  private readonly random: RandomSource;

  constructor(dependencies: NightPipelineDependencies) {
    this.world = dependencies.world;
    this.toolGateway = dependencies.toolGateway;
    this.damageResolutionSystem = dependencies.damageResolutionSystem;
    this.events = dependencies.events;
    this.stageRegistry = dependencies.stageRegistry ?? getDefaultNightStageRegistry();
    this.random = dependencies.random ?? createRandom();
  }

  /**
   * 执行完整夜间流程并返回结算摘要与伤害结果。
   */
  async execute(
    config: BoardConfig,
    actionProvider: ActionProvider,
    day: number,
    options: NightPipelineOptions = {},
  ): Promise<NightPipelineResult> {
    const isCurrent = options.isCurrent ?? (() => true);
    if (!isCurrent()) return { interrupted: true };
    if(hasDreamNightCommit(this.world,day))throw new Error("dream_night_reentry_after_commit");
    if(hasRoleInspectionNightCommit(this.world,day))throw new Error("role_inspection_night_reentry_after_commit");
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
      wolfChatOrder: [],
      endedWolves: new Set<EntityId>(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      dreamLinks: [],
      poisonClaims: [],
    };

    const requests = new GameActionRequestFactory(this.world, this.events, day);
    const stageCtx = {
      isCurrent,
      previousExile: options.previousExile ? structuredClone(options.previousExile) : null,
      world: this.world,
      roleCatalog: this.stageRegistry.roleCatalog,
      toolGateway: this.toolGateway,
      events: this.events,
      actionProvider,
      currentDay: () => day,
      makeRequest: (
        actorId: EntityId,
        allowedTools: ActionRequest["allowedTools"],
        context: ActionRequestExtras & { stage: ActionStage; requiresAction?: boolean },
      ) => this.makeRequest(requests, actorId, allowedTools, context),
      getAliveByRole: (role: Role) => this.getAliveByRole(role),
      ensureMarks: (entityId: EntityId) => this.ensureMarks(entityId),
      pickMajorityTarget: (votes: Record<number, number>) =>
        this.pickMajorityTarget(
          votes,
          config.tieBreaker?.wolfKillVote ?? "min_id",
        ),
      shuffleWolves: (ids: EntityId[]) => shuffled(ids, this.random.fork(`day:${day}:wolf-order`)),
      state: stageState,
    };

    for (const stage of this.stageRegistry.getStages(config, this.world)) {
      if (!isCurrent()) return { interrupted: true };
      discardStaleWolfKnife(this.world,stageState);
      await stage.execute(stageCtx);
      if (!isCurrent()) return { interrupted: true };
      discardStaleWolfKnife(this.world,stageState);
    }

    discardStaleWolfKnife(this.world,stageState);
    const dreamFrame = new DreamNightFrame(stageState.dreamLinks);
    const damage = this.damageResolutionSystem.resolve(this.world,{protectedTargets:dreamFrame.protectedTargets(this.world),consecutiveDeaths:dreamFrame.consecutiveDeaths(this.world),poisonClaims:stageState.poisonClaims});
    dreamFrame.expandInitialDamage(this.world,damage);
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

    const deathLives=new Map(damage.deaths.map(id=>{const life=this.world.getComponent<AliveComponent>(id,COMPONENT.Alive)!;return[id,{life,version:aliveLifeVersion(life)}] as const;}));
    return { interrupted: false, summary, damage, dreamFrame,deathLives };
  }

  private makeRequest(
    requests: GameActionRequestFactory,
    actorId: EntityId,
    allowedTools: ActionRequest["allowedTools"],
    context: ActionRequestExtras & { stage: ActionStage; requiresAction?: boolean },
  ): ActionRequest {
    const { stage, requiresAction = true, ...extraContext } = context;
    return requests.create({
      phase: Phase.Night,
      actorId,
      allowedTools,
      stage,
      requiresAction,
      summary: { key: "request.summary.night_action" },
      context: {
        ...extraContext,
      },
    });
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
  private pickMajorityTarget(
    votes: Record<number, number>,
    strategy: TieBreakerStrategy,
  ): EntityId | null {
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
    if (entries.length >= 2 && entries[0][1] === entries[1][1]) {
      if (strategy === "no_kill") {
        return null;
      }
    }
    return Number(entries[0][0]);
  }

}
