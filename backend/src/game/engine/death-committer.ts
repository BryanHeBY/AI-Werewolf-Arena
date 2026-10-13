/**
 * 负责原生命死亡提交与唯一的已结算生命账本。输入是有序玩家名单、原死亡原因，以及
 * 延迟读取结算器 World、事件数组和运行状态的上下文；输出是原 Alive 修改、事实事件、
 * 待过期枪列表及继承更新。isSettledLife 仅查询，markPlayersDead 是专用死亡写命令。
 * 本所有者不收集死亡波、遗言、枪击选择或警徽决定，不切换阶段，也不执行枪的最终过期。
 * 写入与记录失败均保留原先已提交的前缀，不回滚或提前发布已结算账本条目。
 */
import { getSessionRecorder } from "../../recording/recording_context";
import { isRoleId } from "@ai-werewolf-arena/game-catalog";
import { aliveLifeVersion, type AliveComponent } from "../../core/domain/components/alive";
import { COMPONENT } from "../../core/domain/components/names";
import {
  DeathCause,
  Role,
  type EntityId,
  type GameEvent,
  type RuntimeSnapshot,
  type DeathSources,
} from "../../core/domain/model";
import type { World } from "../../core/domain/world";
import {
  isAnimalDreamBoard,
  commitAnimalPufferKnifeDeath,
} from "../mechanisms/roles/animal_dream/ports";
import {
  isNobleBodyBoard,
  closeServantForDeath,
} from "../mechanisms/roles/noble_secret_body/ports";
import { appendNobleContractClosure } from "../mechanisms/roles/noble_secret_body/ports";
import { recordWildChildDeathCommit } from "../mechanisms/roles/wild_child/ports";
import { firstDeathGuns } from "../mechanisms/roles/death_abilities";
import { expireLuckyAbilitiesOnDeath } from "../mechanisms/roles/ability_changes";
import { refreshHiddenWolfInheritance } from "../mechanisms/roles/hidden_wolf/ports";
import { refreshGargoyleInheritance } from "../mechanisms/roles/gargoyle/ports";
import { refreshMechanicalInheritance } from "../mechanisms/roles/mechanical_wolf/ports";
import { refreshAwakenedInheritance } from "../mechanisms/roles/awakened_hidden_wolf/ports";

interface DeathCommitContext {
  readonly world: World;
  readonly events: GameEvent[];
  readonly state: RuntimeSnapshot;
}

export class DeathCommitter {
  // 每个序号仅记原 Alive 对象与其生命版本；复活或替换组件必须重新结算。
  private readonly settledLives = new Map<
    EntityId,
    { component: AliveComponent; version: number | undefined }
  >();

  constructor(private readonly context: DeathCommitContext) {}

  isSettledLife(id: EntityId): boolean {
    const alive = this.context.world.getComponent(id, COMPONENT.Alive),
      settled = this.settledLives.get(id);
    return (
      alive !== undefined &&
      settled?.component === alive &&
      settled.version === aliveLifeVersion(alive)
    );
  }

  /**
   * 按原名单顺序提交；账本控制首次死亡分支（事实、被动／关系提交与揭示），不替调用方过滤重复 ID。
   * 重入仍写 Alive、收集枪并检查能力到期；gunsToExpire 由外层累积，这里仅追加。
   * 追加枪波关闭继承刷新，由外层在原位置执行；异常保留已提交的玩家和事实前缀。
   */
  markPlayersDead(
    playerIds: EntityId[],
    refreshInheritance = true,
    gunsToExpire: ReturnType<typeof firstDeathGuns> = [],
    reveal = false,
    sources: DeathSources = {},
    animalScope?: object | (() => boolean),
  ): void {
    for (const id of playerIds) {
      const alive = this.context.world.getComponent(id, COMPONENT.Alive);
      if (!alive) {
        continue;
      }
      // 先记 Wild Child 的活跃生命死亡，再改 Alive；不能把首次判断移到修改之后。
      const firstSettlement = !this.isSettledLife(id);
      if (firstSettlement) recordWildChildDeathCommit(this.context.world, id);
      alive.alive = false;
      if (firstSettlement && isAnimalDreamBoard(this.context.world)) {
        if (
          (sources[id] ?? []).includes(DeathCause.WolfKill) &&
          this.context.world.getComponent(id, COMPONENT.Role)?.role === Role.Pufferfish
        ) {
          commitAnimalPufferKnifeDeath(
            this.context.world,
            this.context.state.day,
            sources[id] ?? [],
            animalScope ?? (() => !this.context.state.gameOver),
          );
        }
        if ((sources[id] ?? []).includes(DeathCause.Exile))
          this.context.events.push({
            timestamp: Date.now(),
            type: "voted_out",
            payload: { target: id },
          });
        else if (
          (sources[id] ?? []).some(
            (c) => c === DeathCause.PufferRetaliation || c === DeathCause.WhiteCatExpiry,
          )
        )
          this.context.events.push({
            timestamp: Date.now(),
            type: "additional_deaths",
            payload: { deaths: [id] },
          });
      }
      if (firstSettlement && isNobleBodyBoard(this.context.world)) {
        const closed = closeServantForDeath(this.context.world, this.context.state.day, id);
        const payload = {
          policy: "awa_noble_secret_body_v1" as const,
          actorId: id,
          day: this.context.state.day,
          causes: [...(sources[id] ?? [])],
        };
        this.context.events.push({
          timestamp: Date.now(),
          type: "noble_body_death_committed",
          payload,
          audience: Object.freeze([]),
        });
        getSessionRecorder()?.recordRequiredLogicOp({
          scope: "resolution",
          op: "noble_body_death_committed",
          phase: this.context.state.phase,
          status: "ok",
          output: {
            policy: payload.policy,
            playerId: id,
            day: payload.day,
            causes: payload.causes,
          },
        });
        if (closed)
          appendNobleContractClosure(
            this.context.world,
            this.context.state.day,
            closed,
            this.context.events,
            this.context.state.phase,
          );
      }
      const role = this.context.world.getComponent(id, COMPONENT.Role)?.role;
      if (reveal && firstSettlement && isRoleId(role))
        this.context.events.push({
          timestamp: Date.now(),
          type: "player_role_revealed",
          payload: { playerId: id, role },
        });
      gunsToExpire.push(...firstDeathGuns(this.context.world, id));
      expireLuckyAbilitiesOnDeath(this.context.world, id, this.context.events);
      // 事实、记录、枪列表和能力过期均成功之后才发布账本；任何早期异常不伪造完成。
      this.settledLives.set(id, { component: alive, version: aliveLifeVersion(alive) });
    }
    // 整波生命提交之后按原顺序刷新继承；此处失败不能撤销已写入的生命与账本。
    if (refreshInheritance) {
      refreshHiddenWolfInheritance(this.context.world, this.context.events, this.context.state.day);
      refreshGargoyleInheritance(this.context.world, this.context.events, this.context.state.day);
      refreshMechanicalInheritance(this.context.world, this.context.state.day, this.context.events);
      refreshAwakenedInheritance(this.context.world, this.context.state.day, this.context.events);
    }
  }
}
