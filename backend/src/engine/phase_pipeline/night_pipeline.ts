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

/**
 * 夜间阶段流水线（当前实现）：
 * 狼人交流 -> 守卫 -> 狼人投票 -> 女巫 -> 预言家 -> 统一伤害结算。
 * 各步骤按串行执行，保证状态变更在同一时间线上可追踪。
 */
export class NightPipeline {
  constructor(
    private readonly world: World,
    private readonly roleRegistry: RoleRegistry,
    private readonly toolGateway: ToolGateway,
    private readonly damageResolutionSystem: DamageResolutionSystem,
    private readonly events: GameEvent[],
  ) {}

  async execute(config: BoardConfig, actionProvider: ActionProvider): Promise<{
    summary: NightSummary;
    damage: DamageResolutionResult;
  }> {
    // 每个夜晚开始前重置“同夜双药”状态，避免跨夜污染。
    this.toolGateway.startNight(this.world);

    const wolfIds = this.getAliveByRole(Role.Wolf);

    for (const wolfId of wolfIds) {
      const req = this.makeRequest(
        wolfId,
        ["speak_to_wolves"],
        { phase: "wolf_discussion", day: 0 },
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
          this.events.push({
            timestamp: Date.now(),
            type: "wolf_discussion",
            payload: {
              actorId: wolfId,
              text: result.sanitizedCall.args.text,
            },
          });
        }
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

      const targetId = result.sanitizedCall.args.target_id;
      this.ensureMarks(targetId).add(StatusMark.GuardMark);

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

      const targetId = result.sanitizedCall.args.target_id;
      wolfVotes[targetId] = (wolfVotes[targetId] ?? 0) + 1;
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
      }

      if (potion === "poison") {
        this.ensureMarks(targetId).add(StatusMark.PoisonMark);
        witch.witchState.poison -= 1;
        witch.witchState.poisonUsedThisNight = true;
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

      seerChecks.push({
        seerId,
        targetId,
        isWerewolf: targetRole?.camp === Camp.Wolf,
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
      context,
    };
  }

  private getAliveByRole(role: Role): EntityId[] {
    return this.world.getAliveEntityIds().filter((id) => {
      const roleComp = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return roleComp?.role === role;
    });
  }

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
}
