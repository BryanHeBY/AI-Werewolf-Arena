/**
 * 负责炼金魔女／狼鸦之爪的原角色、阵营、身份与生命授权，输入为 World、参与者和夜序。
 * 输出为原当前性检查、脱离知识与经授权的雾／蛇／额外刀提交；资源绑定及槽写入归 state-slot。
 * 阵营只取已捕获 Camp 的 own-data，组件替换／字段变化仍撤权，不向 Role 写镜像。
 * 不变量：原体、身份或生命撤权后禁止新付款；原首次死亡仅可读取已付款效果／保留知识。
 * 夜初 ravenChecked 先写再转换，后续失败不重开检查；不修补被替换的槽或重复保存库存。
 */
import { types } from "node:util";
import { COMPONENT } from "../../../../domain/components/names";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../../domain/components/alive";
import type { RoleComponent } from "../../../../domain/components/role";
import { Camp } from "../../../../domain/identity";
import type { World } from "../../../../domain/world";
import {
  readMistOwnData as own,
  selectMist,
  selectSnake,
  selectRavenKnife,
  unsealRaven,
  type AlchemistState,
  type RavenState,
} from "./state";

import { MistCasterStateSlot, type MistCasterKind as Caster, type MistCasterState as State } from "./state-slot";

/** 外层夜 owner 提供日次、目标与阶段作用域；本授权只保原参与者／生命，状态写权不反向拥有阶段。 */
export class MistCasterAuthority {
  private readonly role: RoleComponent;
  private readonly privateState: RoleComponent["privateState"];
  private readonly identity: unknown;
  private readonly identityFields: unknown[];
  private readonly life: AliveComponent;
  private readonly lifeVersion: number;
  private readonly camp: Camp;
  private readonly campComponent: unknown;
  private readonly key: "alchemist" | "ravenClaw";
  private readonly stateSlot: MistCasterStateSlot;
  private ravenChecked = false;

  constructor(
    private readonly world: World,
    readonly actorId: number,
    readonly day: number,
    readonly caster: Caster,
  ) {
    if (
      !Number.isSafeInteger(day) ||
      day < 1 ||
      day >= Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(actorId) ||
      actorId < 1 ||
      actorId >= Number.MAX_SAFE_INTEGER ||
      (caster !== "alchemist" && caster !== "raven_claw_wolf")
    )
      throw new Error("mist_caster_authority_invalid");
    const role = world.getComponent(actorId, COMPONENT.Role),
      campComponent = world.getComponent(actorId, COMPONENT.Camp),
      identity = world.getComponent(actorId, COMPONENT.Identity),
      life = world.getComponent(actorId, COMPONENT.Alive);
    this.camp = caster === "alchemist" ? Camp.Good : Camp.Wolf;
    this.key = caster === "alchemist" ? "alchemist" : "ravenClaw";
    if (
      !role ||
      own(role, "role") !== caster ||
      own(campComponent, "camp") !== this.camp ||
      own(campComponent, "camp") !== this.camp ||
      !life ||
      !this.factoryLife(life) ||
      !life.alive ||
      aliveLifeVersion(life) === undefined ||
      own(identity, "id") !== actorId ||
      typeof own(identity, "name") !== "string" ||
      typeof own(identity, "sessionId") !== "string" ||
      !Number.isSafeInteger(own(identity, "seat"))
    )
      throw new Error("mist_caster_authority_invalid");
    const privateState = own(role, "privateState");
    if (
      !privateState ||
      typeof privateState !== "object" ||
      types.isProxy(privateState) ||
      Array.isArray(privateState)
    )
      throw new Error("mist_caster_authority_invalid");
    this.role = role;
    this.campComponent = campComponent;
    this.privateState = privateState as RoleComponent["privateState"];
    this.identity = identity;
    this.identityFields = ["id", "seat", "name", "sessionId"].map((k) => own(identity, k));
    this.life = life;
    this.lifeVersion = aliveLifeVersion(life)!;
    // 原字段已赋值后才读取槽并建立绑定；查询 thunk 保持 caster／容器／key 在原调用点晚读。
    this.stateSlot = new MistCasterStateSlot(
      { caster: () => this.caster, privateState: () => this.privateState, key: () => this.key, assertCurrent: () => this.current() },
      own(privateState, this.key),
    );
  }

  private factoryLife(life: AliveComponent): boolean {
    const expected = aliveLifeDescriptor(life);
    if (!expected) return false;
    const d = Object.getOwnPropertyDescriptor(life, "alive");
    return (
      !!d &&
      d.get === expected.get &&
      d.set === expected.set &&
      d.enumerable === expected.enumerable &&
      d.configurable === expected.configurable
    );
  }
  isCurrent(allowFirstDeath = false): boolean {
    if (
      this.world.getComponent(this.actorId, COMPONENT.Role) !== this.role ||
      own(this.role, "role") !== this.caster ||
      own(this.campComponent, "camp") !== this.camp ||
      this.world.getComponent(this.actorId, COMPONENT.Camp) !== this.campComponent ||
      own(this.campComponent, "camp") !== this.camp ||
      own(this.role, "privateState") !== this.privateState ||
      this.world.getComponent(this.actorId, COMPONENT.Identity) !== this.identity ||
      !["id", "seat", "name", "sessionId"].every(
        (k, i) => own(this.identity, k) === this.identityFields[i],
      ) ||
      this.world.getComponent(this.actorId, COMPONENT.Alive) !== this.life ||
      !this.factoryLife(this.life) ||
      !(this.life.alive
        ? aliveLifeVersion(this.life) === this.lifeVersion
        : allowFirstDeath && aliveLifeVersion(this.life) === this.lifeVersion + 1)
    )
      return false;
    // 参与者／生命全部通过后才复验原槽及逐层引用，不能提前读取或用相同 JSON 新数组补权。
    return this.stateSlot.isCurrent();
  }
  private current(allowFirstDeath = false): State {
    if (!this.isCurrent(allowFirstDeath)) throw new Error("mist_caster_authority_revoked");
    return this.stateSlot.read();
  }
  /** 已付款效果／保留知识可在原身体首次死亡后读取；这不会开启新的资源提交。 */
  state(allowFirstDeath = false): State {
    return this.current(allowFirstDeath);
  }

  /** 仅 beginNight 真实开夜调用一次；权限查询不触发解封，检查标志在可能失败的转换前已写。 */
  checkRavenAtNightStart(livingWolfIds: readonly number[]): RavenState {
    if (this.caster !== "raven_claw_wolf" || this.ravenChecked)
      throw new Error("raven_night_start_reentry");
    const state = this.current() as RavenState;
    this.ravenChecked = true;
    this.stateSlot.install(unsealRaven(state, this.day, this.actorId, livingWolfIds));
    return this.current() as RavenState;
  }
  commitMist(targets: number[] | null, livingIds: readonly number[]): AlchemistState {
    if (this.caster !== "alchemist") throw new Error("mist_caster_kind_invalid");
    this.stateSlot.install(selectMist(this.current() as AlchemistState, this.day, targets, livingIds));
    return this.current() as AlchemistState;
  }
  commitSnake(target: number | null, legalTargets: readonly number[]): AlchemistState {
    if (this.caster !== "alchemist") throw new Error("mist_caster_kind_invalid");
    this.stateSlot.install(selectSnake(this.current() as AlchemistState, this.day, target, legalTargets));
    return this.current() as AlchemistState;
  }
  commitRavenKnife(target: number | null, livingIds: readonly number[]): RavenState {
    if (this.caster !== "raven_claw_wolf" || !this.ravenChecked)
      throw new Error("raven_night_start_required");
    this.stateSlot.install(
      selectRavenKnife(this.current() as RavenState, this.day, this.actorId, target, livingIds),
    );
    return this.current() as RavenState;
  }
}
