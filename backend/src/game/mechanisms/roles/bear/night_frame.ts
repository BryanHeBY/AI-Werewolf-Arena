/**
 * Owns the Bear night frame and deferred dawn publication. Inputs are original neighbor bodies
 * and the sampled roar; outputs are history and dawn events only for the still-matching frame.
 * It does not publish the same captured night twice or substitute revived neighbor bodies.
 */
import { types } from "node:util";
import {
  AliveComponent,
  aliveLifeVersion,
  aliveLifeDescriptor,
} from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { IdentityComponent } from "../../../../core/domain/entities/player";
import { Camp, Role, type GameEvent, type EntityId } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { RoleCatalog, getDefaultRoleCatalog } from "../catalog";
import { getBearState, type BearState } from "../private_state";
import { BEAR_SIGNAL_POLICIES, type BearSignalPolicy } from "@ai-werewolf-arena/game-text";
import {
  captureOriginalPlayer,
  originalPlayerSameLife,
  type OriginalPlayerScope,
} from "../original_player_scope";
import type { CampComponent } from "../../../../core/domain/components/camp";
import { snapshotPlainData } from "../../../../core/domain/plain_data";
const dawnPublications = new WeakMap<
  World,
  Map<number, { status: "checking" | "published" | "revoked" }>
>();
const now = Date.now.bind(Date);
function ownData(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
function appendable(value: unknown): value is unknown[] {
  if (
    !Array.isArray(value) ||
    types.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    return false;
  const d = Object.getOwnPropertyDescriptor(value, "length");
  return (
    !!d?.writable &&
    Number.isSafeInteger(d.value) &&
    d.value < 4294967295 &&
    Object.isExtensible(value)
  );
}
function unpublishedHistory(value: unknown, day: number): boolean {
  try {
    const rows = snapshotPlainData(value, new Set(), 0, 65536);
    return Array.isArray(rows) && !rows.some((report) => ownData(report, "day") === day);
  } catch {
    return false;
  }
}

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
      target?.camp === Camp.Wolf &&
      (catalog.get(target.role)?.detectableByBear?.(world, target) ?? true)
    );
  });
}

/** The snapshot stays with the manager, never on a player component or DTO. */
export class BearNightFrame {
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
    if (role.camp !== Camp.Good || !state || !life || version === undefined) return null;
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

  /** Publish after the complete night death wave and before its victory check. */
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
      this.role.camp !== Camp.Good ||
      getBearState(this.role) !== this.state ||
      world.getComponent(this.actorId, COMPONENT.Alive) !== this.life ||
      aliveLifeVersion(this.life) !==
        this.lifeVersion + (this.wasAlive && !this.life.alive ? 1 : 0) ||
      this.state.history.some((report) => report.day === this.day)
    )
      return;
    const report = { day: this.day, roared: this.life.alive && this.wasAlive && this.sampledRoar };
    this.state.history.push(report);
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
      ownData(this.role, "camp") === Camp.Good &&
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
      // Both inert arrays are appendable; no user callback/setter runs between these two writes.
      Object.defineProperty(events, String(events.length), {
        value: event,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(history, String(history.length), {
        value: report,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      lease.status = "published";
    } finally {
      if (lease.status === "checking") lease.status = "revoked";
    }
  }
}
