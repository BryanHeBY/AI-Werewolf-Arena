/**
 * 负责熊的夜间采样 frame 与延迟到天亮的发布。阵营只读实际 Camp；默认只核值，黎明政策保原组件引用撤权。输入为原相邻玩家和采样吼声；只有匹配原 frame 时才产生历史与天亮事件。不重复发布同一夜，不以复活或替换相邻身体继续旧采样；关闭和失败保持原前缀。
 */
import {
  recordBearRoar,
  bearDataField as ownData,
  bearDataArrayAppendable as appendable,
  bearHistoryUnpublished as unpublishedHistory,
  recordDawnBearRoar,
} from "./state";

import type { BearReadState as BearState } from "@ai-werewolf-arena/game-contract";

import {
  AliveComponent,
  aliveLifeVersion,
  aliveLifeDescriptor,
} from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import type { IdentityComponent } from "../../domain/entities/player";
import { Camp, Role, type GameEvent, type EntityId } from "../../domain/model";
import type { World } from "../../domain/world";
import { RoleCatalog } from "../../rulesets/roles/catalog";
import { getDefaultRoleCatalog } from "../../rulesets/roles/role-catalog-assembly";
import { getBearState } from "./state";
import { BEAR_SIGNAL_POLICIES, type BearSignalPolicy } from "@ai-werewolf-arena/game-contract";
import {
  captureOriginalPlayer,
  originalPlayerSameLife,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import type { CampComponent } from "../../domain/components/camp";
/** 同一 World／夜号的黎明发表状态：checking 只允许当前尝试，重入会撤销它；
 * 成功后 published，未完成则 finally 置 revoked。清空原 state.history 不恢复这一原发布许可。 */
const dawnPublications = new WeakMap<
  World,
  Map<number, { status: "checking" | "published" | "revoked" }>
>();
const now = Date.now.bind(Date);

function sampleRoar(world: World, actorId: EntityId, catalog: RoleCatalog): boolean {
  const ring = world
      .getAliveEntityIds()
      .sort(
        (a, b) =>
          (world.getComponent(a, COMPONENT.Identity)?.seat ?? a) -
            (world.getComponent(b, COMPONENT.Identity)?.seat ?? b) || a - b,
      ),
    index = ring.indexOf(actorId),
    neighbors =
      index < 0 || ring.length < 2
        ? []
        : [
            ...new Set([
              ring[(index + ring.length - 1) % ring.length],
              ring[(index + 1) % ring.length],
            ]),
          ];
  return neighbors.some((id) => {
    const target = world.getComponent(id, COMPONENT.Role);
    return (
      !!target &&
      world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf &&
      (catalog.runtime(target.role)?.detectableByBear?.(world, target) ?? true)
    );
  });
}

/** 快照由 manager 持有，不放在玩家 component 或 DTO 中。 */
export class BearNightFrame {
  /** 保留原 World、Role、state、Alive／Camp 与名单的实例引用及生命版本，不克隆为玩家 DTO。
   * 默认政策捕获夜初吼声；显式黎明政策保留原体名单和 catalog，在真正发表时才重新采样并复验。 */
  private constructor(
    private readonly owner: World,
    private readonly day: number,
    private readonly actorId: EntityId,
    private readonly role: RoleComponent,
    private readonly state: BearState,
    private readonly life: AliveComponent,
    private readonly lifeVersion: number,
    private readonly wasAlive: boolean,
    private readonly sampledRoar: boolean,
    private readonly signalPolicy: BearSignalPolicy,
    private readonly catalog: RoleCatalog,
    private readonly originals: readonly OriginalPlayerScope[],
    private readonly camp: CampComponent | undefined,
  ) {}

  static capture(
    world: World,
    day: number,
    catalog: RoleCatalog = getDefaultRoleCatalog(),
    signalPolicy: BearSignalPolicy = "awa_night_open_v1",
  ): BearNightFrame | null {
    if (!BEAR_SIGNAL_POLICIES.includes(signalPolicy)) throw Error("bear_signal_policy_invalid");
    const bears = world
      .entityIds()
      .filter((id) => world.getComponent(id, COMPONENT.Role)?.role === Role.Bear);
    if (bears.length > 1) throw new Error("bear_count_exceeds_limit");
    const actorId = bears[0];
    if (actorId === undefined) return null;
    const role = world.getComponent(actorId, COMPONENT.Role)!,
      state = getBearState(role),
      life = world.getComponent(actorId, COMPONENT.Alive),
      version = life && aliveLifeVersion(life);
    if (
      world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Good ||
      !state ||
      !life ||
      version === undefined
    )
      return null;
    const originals =
        signalPolicy === "netease_dawn_live_v1"
          ? world.getAliveEntityIds().map((id) => captureOriginalPlayer(world, id))
          : [],
      camp = world.getComponent(actorId, COMPONENT.Camp);
    if (
      originals.some((p) => p === null) ||
      (signalPolicy === "netease_dawn_live_v1" && camp?.camp !== Camp.Good)
    )
      return null;
    const roared =
      signalPolicy === "awa_night_open_v1" ? sampleRoar(world, actorId, catalog) : false;
    return new BearNightFrame(
      world,
      day,
      actorId,
      role,
      state,
      life,
      version,
      life.alive,
      roared,
      signalPolicy,
      catalog,
      originals as OriginalPlayerScope[],
      camp,
    );
  }

  /** 完整夜死亡波后、该波判胜前发表。 */
  publish(world: World, events: GameEvent[], isCurrent: () => boolean): void {
    if (this.signalPolicy === "netease_dawn_live_v1") {
      this.publishDawn(world, events, isCurrent);
      return;
    }
    if (
      world !== this.owner ||
      !isCurrent() ||
      world.getComponent(this.actorId, COMPONENT.Role) !== this.role ||
      this.role.role !== Role.Bear ||
      world.getComponent(this.actorId, COMPONENT.Camp)?.camp !== Camp.Good ||
      getBearState(this.role) !== this.state ||
      world.getComponent(this.actorId, COMPONENT.Alive) !== this.life ||
      aliveLifeVersion(this.life) !==
        this.lifeVersion + (this.wasAlive && !this.life.alive ? 1 : 0) ||
      this.state.history.some((report) => report.day === this.day)
    )
      return;
    const report = { day: this.day, roared: this.life.alive && this.wasAlive && this.sampledRoar };
    recordBearRoar(this.state, report);
    events.push({ timestamp: Date.now(), type: "bear_roared", payload: { ...report } });
  }
  private dawnBodyCurrent(world: World): boolean {
    const factory = aliveLifeDescriptor(this.life);
    if (!factory) return false;
    const actual = Object.getOwnPropertyDescriptor(this.life, "alive"),
      history = ownData(this.state, "history");
    return (
      actual?.get === factory.get &&
      actual?.set === factory.set &&
      world.getComponent(this.actorId, COMPONENT.Role) === this.role &&
      ownData(this.role, "role") === Role.Bear &&
      ownData(this.camp, "camp") === Camp.Good &&
      ownData(ownData(this.role, "privateState"), "bear") === this.state &&
      world.getComponent(this.actorId, COMPONENT.Alive) === this.life &&
      aliveLifeVersion(this.life) ===
        this.lifeVersion + (this.wasAlive && !this.life.alive ? 1 : 0) &&
      world.getComponent(this.actorId, COMPONENT.Camp) === this.camp &&
      ownData(this.camp, "camp") === Camp.Good &&
      this.originals.every((p) => originalPlayerSameLife(world, p, true)) &&
      world.getAliveEntityIds().every((id) => this.originals.some((p) => p.id === id)) &&
      unpublishedHistory(history, this.day)
    );
  }
  private publishDawn(world: World, events: GameEvent[], isCurrent: () => boolean): void {
    if (world !== this.owner) return;
    let publications = dawnPublications.get(world);
    if (!publications) {
      publications = new Map();
      dawnPublications.set(world, publications);
    }
    const prior = publications.get(this.day);
    if (prior) {
      if (prior.status === "checking") prior.status = "revoked";
      return;
    }
    const lease: { status: "checking" | "published" | "revoked" } = { status: "checking" };
    publications.set(this.day, lease);
    try {
      if (!isCurrent() || !this.dawnBodyCurrent(world)) return;
      const before = this.originals.map((p) => ({
          p,
          version: aliveLifeVersion(p.life),
          identity: world.getComponent(p.id, COMPONENT.Identity),
          seat: ownData(world.getComponent(p.id, COMPONENT.Identity), "seat"),
        })),
        sampled =
          this.life.alive && this.wasAlive ? sampleRoar(world, this.actorId, this.catalog) : false;
      if (
        !isCurrent() ||
        lease.status !== "checking" ||
        !this.dawnBodyCurrent(world) ||
        before.some(
          ({ p, version, identity, seat }) =>
            aliveLifeVersion(p.life) !== version ||
            world.getComponent(p.id, COMPONENT.Identity) !== identity ||
            ownData(identity, "seat") !== seat,
        )
      )
        return;
      const history = ownData(this.state, "history");
      if (history === events || !appendable(history) || !appendable(events)) return;
      const report = { day: this.day, roared: this.life.alive && this.wasAlive && sampled },
        event: GameEvent = { timestamp: now(), type: "bear_roared", payload: { ...report } };
      // 两个原受控数组按事件→历史写入；原生 defineProperty 不执行数组元素 setter。
      // 这不是事务：第二次写抛错时第一事件保留，finally 只撤销尚 checking 的发布状态，不回滚数组。
      Object.defineProperty(events, String(events.length), {
        value: event,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      recordDawnBearRoar(history, report);
      lease.status = "published";
    } finally {
      if (lease.status === "checking") lease.status = "revoked";
    }
  }
}
