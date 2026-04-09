import { AliveComponent } from "../domain/components/alive";
import { BadgeComponent } from "../domain/components/badge";
import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import { VotingRightComponent } from "../domain/components/voting_right";
import { EntityId, GameEvent, Phase, Role, StatusMark } from "../domain/model";
import { World } from "../domain/world";
import { transferOrDestroySheriffBadge } from "./sheriff_badge";

/**
 * 放逐阶段处理结果。
 */
export interface VotedOutResult {
  prevented: boolean;
  removed: EntityId[];
  reason: string;
}

/**
 * 死亡钩子处理结果（含追加死亡）。
 */
export interface DeathHookResult {
  extraDeaths: EntityId[];
  extraDeathSources: Record<number, StatusMark[]>;
}

/**
 * 事件总线拦截器：
 * - onVotedOut: 处理白痴翻牌免死与警徽销毁。
 * - onDeath: 处理猎人是否可开枪、开枪造成的追加死亡。
 */
export class EventRegistry {
  /**
   * 处理放逐事件：包含白痴翻牌免死与警徽处理分支。
   */
  onVotedOut(world: World, targetId: EntityId, events: GameEvent[]): VotedOutResult {
    const roleComp = world.getComponent<RoleComponent>(targetId, COMPONENT.Role);
    const aliveComp = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive);

    if (!roleComp || !aliveComp || !aliveComp.alive) {
      return { prevented: false, removed: [], reason: "invalid_target" };
    }

    if (roleComp.role === Role.Idiot) {
      // 白痴被放逐时翻牌免死，但立即失去后续投票权。
      roleComp.idiotState = {
        revealed: true,
      };

      const voting = world.getComponent<VotingRightComponent>(
        targetId,
        COMPONENT.VotingRight,
      );
      if (voting) {
        voting.canVote = false;
        voting.weight = 0;
      }

      const badge = world.getComponent<BadgeComponent>(targetId, COMPONENT.Badge);
      if (badge?.isSheriff) {
        transferOrDestroySheriffBadge(world, targetId, "idiot_revealed", events);
      }

      events.push({
        timestamp: Date.now(),
        type: "idiot_revealed",
        payload: {
          targetId,
        },
      });

      return {
        prevented: true,
        removed: [],
        reason: "idiot_revealed",
      };
    }

    const badge = world.getComponent<BadgeComponent>(targetId, COMPONENT.Badge);
    if (badge?.isSheriff) {
      transferOrDestroySheriffBadge(world, targetId, "voted_out", events);
    }

    aliveComp.alive = false;
    return {
      prevented: false,
      removed: [targetId],
      reason: "normal_voted_out",
    };
  }

  async onDeath(
    world: World,
    deadIds: EntityId[],
    deathSources: Record<number, StatusMark[]>,
    onHunterShoot: (hunterId: EntityId) => Promise<EntityId | null>,
    events: GameEvent[],
  ): Promise<DeathHookResult> {
    const extraDeaths: EntityId[] = [];
    const extraDeathSources: Record<number, StatusMark[]> = {};

    for (const deadId of deadIds) {
      const roleComp = world.getComponent<RoleComponent>(deadId, COMPONENT.Role);
      if (!roleComp || roleComp.role !== Role.Hunter || !roleComp.hunterState) {
        continue;
      }

      const sources = deathSources[deadId] ?? [];
      if (sources.includes(StatusMark.PoisonMark)) {
        // 猎人吃毒属于闷枪场景，不触发开枪阶段。
        roleComp.hunterState.canShoot = false;
        events.push({
          timestamp: Date.now(),
          type: "hunter_silent_due_to_poison",
          payload: { hunterId: deadId },
        });
        continue;
      }

      if (!roleComp.hunterState.canShoot || this.isLastGod(world, deadId)) {
        roleComp.hunterState.canShoot = false;
        continue;
      }

      const targetId = await onHunterShoot(deadId);
      roleComp.hunterState.canShoot = false;
      if (targetId === null) {
        continue;
      }

      const targetAlive = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive);
      if (!targetAlive || !targetAlive.alive) {
        continue;
      }

      targetAlive.alive = false;
      extraDeaths.push(targetId);
      extraDeathSources[targetId] = [StatusMark.WolfKillMark];
      events.push({
        timestamp: Date.now(),
        type: "hunter_shot",
        payload: {
          hunterId: deadId,
          targetId,
        },
      });
    }

    return { extraDeaths, extraDeathSources };
  }

  /**
   * 遗言规则：
   * 1) 首夜死亡可遗言（支持多死）；
   * 2) 白天放逐死亡可遗言；
   * 3) 其他死亡（自爆、连带死亡）默认无遗言。
   */
  recordLastWords(
    world: World,
    deadIds: EntityId[],
    phase: Phase,
    day: number,
    events: GameEvent[],
  ): void {
    for (const deadId of deadIds) {
      if (!this.shouldGrantLastWords(phase, day)) {
        continue;
      }

      const alive = world.getComponent<AliveComponent>(deadId, COMPONENT.Alive);
      if (!alive || alive.alive) {
        continue;
      }

      events.push({
        timestamp: Date.now(),
        type: "last_words_granted",
        payload: {
          playerId: deadId,
          phase,
          day,
        },
      });
    }
  }

  /**
   * 判定该死亡场景是否允许遗言。
   */
  shouldGrantLastWords(phase: Phase, day: number): boolean {
    return (phase === Phase.Night && day === 1) || phase === Phase.Voting;
  }

  /**
   * 判定猎人是否为最后存活神职。
   */
  private isLastGod(world: World, hunterId: EntityId): boolean {
    // 若猎人是最后存活神职，则开枪不会改变屠边结论，直接不触发。
    const alive = world.getAliveEntityIds();
    for (const id of alive) {
      if (id === hunterId) {
        continue;
      }
      const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (
        role &&
        [Role.Seer, Role.Guard, Role.Witch, Role.Hunter, Role.Idiot].includes(
          role.role,
        )
      ) {
        return false;
      }
    }
    return true;
  }
}
