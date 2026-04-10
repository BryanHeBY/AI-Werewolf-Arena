import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { StatusMarksComponent } from "../../domain/components/status_marks";
import {
  ActionProvider,
  ActionRequest,
  BoardConfig,
  Camp,
  EntityId,
  GameEvent,
  NightSummary,
  Phase,
  Role,
  StatusMark,
} from "../../domain/model";
import { RoleRegistry } from "../../domain/registries/role_registry";
import {
  DamageResolutionResult,
  DamageResolutionSystem,
} from "../../domain/systems/damage_resolution_system";
import { World } from "../../domain/world";
import { ToolGateway } from "../../gateway/tool_gateway";
import { buildAgentBroadcastFeed } from "../agent_broadcast_feed";

/**
 * 夜间阶段流水线（当前实现）：
 * 狼人交流 -> 守卫 -> 狼人投票 -> 女巫 -> 预言家 -> 统一伤害结算。
 * 各步骤按串行执行，保证状态变更在同一时间线上可追踪。
 */
export class NightPipeline {
  private static readonly WOLF_DISCUSSION_MAX_ROUNDS = 3;

  constructor(
    private readonly world: World,
    private readonly roleRegistry: RoleRegistry,
    private readonly toolGateway: ToolGateway,
    private readonly damageResolutionSystem: DamageResolutionSystem,
    private readonly events: GameEvent[],
  ) {}

  /**
   * 执行完整夜间流程并返回结算摘要与伤害结果。
   */
  async execute(config: BoardConfig, actionProvider: ActionProvider): Promise<{
    summary: NightSummary;
    damage: DamageResolutionResult;
  }> {
    // 每个夜晚开始前重置“同夜双药”状态，避免跨夜污染。
    this.toolGateway.startNight(this.world);

    const wolfIds = this.shuffleWolves(this.getAliveByRole(Role.Wolf));

    if (wolfIds.length > 0) {
      this.events.push({
        timestamp: Date.now(),
        type: "wolf_tactical_order",
        payload: {
          order: [...wolfIds],
        },
      });
    }

    // 狼队夜聊最多三轮，且每轮都复用同一随机顺序；
    // speak_to_wolves(end_chat=true) 表示本狼人结束后续夜聊轮次。
    const endedWolves = new Set<EntityId>();
    for (
      let round = 1;
      round <= NightPipeline.WOLF_DISCUSSION_MAX_ROUNDS;
      round++
    ) {
      for (const wolfId of wolfIds) {
        if (endedWolves.has(wolfId)) {
          continue;
        }
        const req = this.makeRequest(
          wolfId,
          ["speak_to_wolves"],
          {
            phase: "wolf_discussion",
            day: 0,
            round,
            max_rounds: NightPipeline.WOLF_DISCUSSION_MAX_ROUNDS,
          },
        );
        const action = await actionProvider.getAction(req);
        if (action?.name === "speak_to_wolves") {
          const result = this.toolGateway.validateAndSanitize(
            this.world,
            wolfId,
            action,
            { phase: Phase.Night },
          );
          if (result.ok && result.sanitizedCall) {
            if (result.sanitizedCall.args.end_chat) {
              endedWolves.add(wolfId);
              this.events.push({
                timestamp: Date.now(),
                type: "wolf_discussion_ended",
                payload: {
                  actorId: wolfId,
                  reason: result.sanitizedCall.args.text,
                  round,
                },
              });
            } else {
              this.events.push({
                timestamp: Date.now(),
                type: "wolf_discussion",
                payload: {
                  actorId: wolfId,
                  text: result.sanitizedCall.args.text,
                  endChat: false,
                  round,
                },
              });
            }
          }
        }
      }

      if (endedWolves.size === wolfIds.length) {
        break;
      }
    }

    for (const guardId of this.getAliveByRole(Role.Guard)) {
      const req = this.makeRequest(guardId, ["guard"], { phase: "guard" });
      const action = await actionProvider.getAction(req);
      if (action?.name !== "guard") {
        continue;
      }

      const result = this.toolGateway.validateAndSanitize(
        this.world,
        guardId,
        action,
        { phase: Phase.Night },
      );
      if (!result.ok || !result.sanitizedCall) {
        continue;
      }

      if (result.sanitizedCall.args.abstain || result.sanitizedCall.args.target_id === null) {
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      this.ensureMarks(targetId).add(StatusMark.GuardMark);
      this.events.push({
        timestamp: Date.now(),
        type: "guard_applied",
        payload: {
          actorId: guardId,
          targetId,
        },
      });

      const role = this.world.getComponent<RoleComponent>(guardId, COMPONENT.Role);
      if (role?.guardState) {
        role.guardState.lastTarget = targetId;
      }
    }

    const wolfVotes: Record<number, number> = {};
    for (const wolfId of wolfIds) {
      const req = this.makeRequest(wolfId, ["kill_vote"], { phase: "wolf_vote" });
      const action = await actionProvider.getAction(req);
      if (action?.name !== "kill_vote") {
        continue;
      }

      const result = this.toolGateway.validateAndSanitize(
        this.world,
        wolfId,
        action,
        { phase: Phase.Night },
      );
      if (!result.ok || !result.sanitizedCall) {
        continue;
      }

      const abstain = result.sanitizedCall.args.abstain === true;
      const targetId = result.sanitizedCall.args.target_id;
      if (!abstain && targetId !== null) {
        wolfVotes[targetId] = (wolfVotes[targetId] ?? 0) + 1;
      }
      this.events.push({
        timestamp: Date.now(),
        type: "wolf_kill_vote_cast",
        payload: {
          actorId: wolfId,
          abstain,
          targetId,
        },
      });
    }

    // 狼队目标由票多者决定；平票时按 seat/id 最小值兜底。
    const wolfTarget = this.pickMajorityTarget(wolfVotes);
    if (wolfTarget !== null) {
      this.ensureMarks(wolfTarget).add(StatusMark.WolfKillMark);
    }

    for (const witchId of this.getAliveByRole(Role.Witch)) {
      const req = this.makeRequest(witchId, ["use_potion"], {
        phase: "witch",
        wolf_target: wolfTarget,
      });
      const action = await actionProvider.getAction(req);
      if (action?.name !== "use_potion") {
        continue;
      }

      const result = this.toolGateway.validateAndSanitize(
        this.world,
        witchId,
        action,
        { phase: Phase.Night },
      );
      if (!result.ok || !result.sanitizedCall) {
        continue;
      }

      const witch = this.world.getComponent<RoleComponent>(witchId, COMPONENT.Role);
      if (!witch?.witchState) {
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      const potion = result.sanitizedCall.args.potion_type;

      if (potion === "heal") {
        this.ensureMarks(targetId).add(StatusMark.HealMark);
        witch.witchState.heal -= 1;
        witch.witchState.healUsedThisNight = true;
        this.events.push({
          timestamp: Date.now(),
          type: "witch_potion_used",
          payload: {
            actorId: witchId,
            targetId,
            potionType: "heal",
          },
        });
      }

      if (potion === "poison") {
        this.ensureMarks(targetId).add(StatusMark.PoisonMark);
        witch.witchState.poison -= 1;
        witch.witchState.poisonUsedThisNight = true;
        this.events.push({
          timestamp: Date.now(),
          type: "witch_potion_used",
          payload: {
            actorId: witchId,
            targetId,
            potionType: "poison",
          },
        });
      }
    }

    const seerChecks: NightSummary["seerChecks"] = [];
    for (const seerId of this.getAliveByRole(Role.Seer)) {
      const req = this.makeRequest(seerId, ["check_identity"], {
        phase: "seer",
      });
      const action = await actionProvider.getAction(req);
      if (action?.name !== "check_identity") {
        continue;
      }

      const result = this.toolGateway.validateAndSanitize(
        this.world,
        seerId,
        action,
        { phase: Phase.Night },
      );
      if (!result.ok || !result.sanitizedCall) {
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      const targetRole = this.world.getComponent<RoleComponent>(targetId, COMPONENT.Role);
      const isWerewolf = targetRole?.camp === Camp.Wolf;
      const seerRole = this.world.getComponent<RoleComponent>(seerId, COMPONENT.Role);
      if (seerRole?.seerState) {
        seerRole.seerState.lastTarget = targetId;
        seerRole.seerState.lastIsWerewolf = isWerewolf;
        seerRole.seerState.history.push({
          targetId,
          isWerewolf,
        });
      }

      seerChecks.push({
        seerId,
        targetId,
        isWerewolf,
      });
      this.events.push({
        timestamp: Date.now(),
        type: "seer_checked",
        payload: {
          actorId: seerId,
          targetId,
          isWerewolf: targetRole?.camp === Camp.Wolf,
        },
      });
    }

    const damage = this.damageResolutionSystem.resolve(this.world);

    const summary: NightSummary = {
      wolfTarget,
      deaths: [...damage.deaths],
      seerChecks,
      interruptedBySelfDestruct: false,
    };

    this.events.push({
      timestamp: Date.now(),
      type: "night_resolved",
      payload: {
        wolfTarget,
        deaths: summary.deaths,
      },
    });

    return { summary, damage };
  }

  private makeRequest(
    actorId: EntityId,
    allowedTools: ActionRequest["allowedTools"],
    context: ActionRequest["context"],
  ): ActionRequest {
    return {
      phase: Phase.Night,
      actorId,
      allowedTools,
      context: {
        must_act: true,
        broadcast_feed: buildAgentBroadcastFeed(this.world, this.events, actorId),
        ...context,
      },
    };
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
  private pickMajorityTarget(votes: Record<number, number>): EntityId | null {
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
    return Number(entries[0][0]);
  }

  /**
   * 生成狼人随机顺序（供夜聊与投票复用）。
   */
  private shuffleWolves(ids: EntityId[]): EntityId[] {
    // 夜间狼人发言与投票必须共用同一随机顺序，以便回放可追踪。
    const copied = [...ids];
    for (let i = copied.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied;
  }
}
