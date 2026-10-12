/**
 * Owns Mist/Raven caster state bindings and audited mist, Snake and Raven knife writes. Inputs
 * are original role/life/state data; outputs are checked stock updates and committed effects
 * only while the captured caster matches. Stale or closed caster authority fails without
 * installing a replacement state.
 */
import { types } from "node:util";
import { COMPONENT } from "../../../../core/domain/components/names";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../../core/domain/components/alive";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
import {
  readAlchemistState,
  readRavenState,
  selectMist,
  selectSnake,
  selectRavenKnife,
  unsealRaven,
  type AlchemistState,
  type RavenState,
} from "./state";

type Caster = "alchemist" | "raven_claw_wolf";
type State = AlchemistState | RavenState;
function own(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
interface StateBinding {
  raw: State;
  expected: string;
  arrays: Array<{ key: string; value: unknown; rows: unknown[]; nestedTargets?: unknown[] }>;
}

/** Per-night caster state authority. The enclosing night owner supplies day, targets and phase scope. */
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
  private binding: StateBinding;
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
      own(role, "camp") !== this.camp ||
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
    this.binding = this.bind(own(privateState, this.key));
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
  private read(raw: unknown): State | undefined {
    return this.caster === "alchemist" ? readAlchemistState(raw) : readRavenState(raw);
  }
  private bind(raw: unknown): StateBinding {
    const state = this.read(raw);
    if (!state) throw new Error("mist_caster_state_invalid");
    const names =
      this.caster === "alchemist"
        ? ["mistHistory", "healHistory"]
        : ["knownTeammateIds", "extraHistory"];
    return {
      raw: raw as State,
      expected: JSON.stringify(state),
      arrays: names.map((key) => {
        const value = own(raw, key) as unknown[];
        const rows = Array.from({ length: own(value, "length") as number }, (_value, index) =>
          own(value, String(index)),
        );
        return {
          key,
          value,
          rows,
          ...(key === "mistHistory"
            ? { nestedTargets: rows.map((row) => own(row, "targetIds")) }
            : {}),
        };
      }),
    };
  }
  isCurrent(allowFirstDeath = false): boolean {
    if (
      this.world.getComponent(this.actorId, COMPONENT.Role) !== this.role ||
      own(this.role, "role") !== this.caster ||
      own(this.role, "camp") !== this.camp ||
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
        : allowFirstDeath && aliveLifeVersion(this.life) === this.lifeVersion + 1) ||
      own(this.privateState, this.key) !== this.binding.raw
    )
      return false;
    const value = this.read(this.binding.raw);
    return (
      !!value &&
      JSON.stringify(value) === this.binding.expected &&
      this.binding.arrays.every(
        (a) =>
          own(this.binding.raw, a.key) === a.value &&
          own(a.value, "length") === a.rows.length &&
          a.rows.every(
            (row, i) =>
              own(a.value, String(i)) === row &&
              (!a.nestedTargets || own(row, "targetIds") === a.nestedTargets[i]),
          ),
      )
    );
  }
  private current(allowFirstDeath = false): State {
    if (!this.isCurrent(allowFirstDeath)) throw new Error("mist_caster_authority_revoked");
    return this.read(this.binding.raw)!;
  }
  private install(next: State): void {
    this.current();
    const binding = this.bind(next);
    Object.defineProperty(this.privateState, this.key, {
      value: next,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    this.binding = binding;
  }
  /** Paid effects/retained knowledge may be read after exactly the original body's first death. */
  state(allowFirstDeath = false): State {
    return this.current(allowFirstDeath);
  }

  /** Called once by beginNight; permission queries never invoke this transition. */
  checkRavenAtNightStart(livingWolfIds: readonly number[]): RavenState {
    if (this.caster !== "raven_claw_wolf" || this.ravenChecked)
      throw new Error("raven_night_start_reentry");
    const state = this.current() as RavenState;
    this.ravenChecked = true;
    this.install(unsealRaven(state, this.day, this.actorId, livingWolfIds));
    return this.current() as RavenState;
  }
  commitMist(targets: number[] | null, livingIds: readonly number[]): AlchemistState {
    if (this.caster !== "alchemist") throw new Error("mist_caster_kind_invalid");
    this.install(selectMist(this.current() as AlchemistState, this.day, targets, livingIds));
    return this.current() as AlchemistState;
  }
  commitSnake(target: number | null, legalTargets: readonly number[]): AlchemistState {
    if (this.caster !== "alchemist") throw new Error("mist_caster_kind_invalid");
    this.install(selectSnake(this.current() as AlchemistState, this.day, target, legalTargets));
    return this.current() as AlchemistState;
  }
  commitRavenKnife(target: number | null, livingIds: readonly number[]): RavenState {
    if (this.caster !== "raven_claw_wolf" || !this.ravenChecked)
      throw new Error("raven_night_start_required");
    this.install(
      selectRavenKnife(this.current() as RavenState, this.day, this.actorId, target, livingIds),
    );
    return this.current() as RavenState;
  }
}
