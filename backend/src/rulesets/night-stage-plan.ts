/**
 * Owns the existing finite night-stage closure, collection and ordering algorithm.
 * Inputs are the configured role set, role catalog and optional current World;
 * outputs are the same stage handlers with explicit snapshot or opaque source mode.
 * Compilation delegates through getStages so injected overrides retain control.
 * Metadata only inspects ordinary own data descriptors; Proxy, inherited and
 * accessor fields remain opaque without extra getter calls. Only ordinary native
 * dense arrays become frozen membership; custom/lazy sources keep original iteration
 * and failure prefixes. Original handlers, World and ability instances remain mutable;
 * this is not a complete RulePlan or immutable callback policy. Registration explicitly
 * shares the same original handler and rejects distinct-handler ID conflicts.
 */
/**
 * Collects, deduplicates and orders registered night stages for present and declared abilities.
 * Inputs are catalog profiles, current roles and possible ability roles; output is the assembled
 * stage list. It does not freeze which player will act or instantiate an ability resource.
 */
import { demonHunterActorId } from "../game/mechanisms/roles/demon_hunter/authority";
import { types } from "node:util";
import { DEMON_HUNTER_NIGHT_STAGE } from "../game/mechanisms/roles/demon_hunter/night_stages";
import {
  WEDDING_CHAT_STAGE,
  WEDDING_KNIFE_STAGE,
} from "../game/mechanisms/roles/ghost_bride/night_stages";
/** 文件说明：根据板子角色集合构建夜间阶段列表。 */
import { BoardConfig, Role } from "../core/domain/model";
import { RoleCatalog, getDefaultRoleCatalog } from "../game/mechanisms/roles/catalog";
import { NightStageHandler } from "../game/mechanisms/stages/night/contracts";
import type { World } from "../core/domain/world";
import { COMPONENT } from "../core/domain/components/names";
import type { RoleComponent } from "../core/domain/components/role";
import { allNightAbilities, type NightAbilityKind } from "../game/mechanisms/roles/abilities";

import {
  ROLE_INSPECTION_STAGE,
  PSYCHIC_INSPECTION_STAGE,
  MIRROR_INSPECTION_STAGE,
} from "../game/mechanisms/roles/role_inspection/night_stages";
import { BLACK_MARKET_RECIPIENT_STAGE } from "../game/mechanisms/roles/black_market_merchant/night_stage";
import { LUCKY_ABILITY_STAGE } from "../game/mechanisms/roles/miracle_merchant/lucky_stage";
import { allDeathGuns } from "../game/mechanisms/roles/death_abilities";
import { DEATH_ABILITY_ACTIVATION_STAGE } from "../game/mechanisms/roles/death_ability_activation";
import { registerNightStages, applyGhostBrideStageRegistration } from "./night-stage-registration";

const abilityRole: Record<NightAbilityKind, Role> = {
  pair_check: Role.AwakenedSeer,
  shelter: Role.RadiantCount,
  seer_check: Role.Seer,
  role_check: Role.Gargoyle,
  guard: Role.Guard,
  potion: Role.Witch,
  dream: Role.Dreamer,
};

export type NightStageMetadata =
  | Readonly<{ ordinal: number; kind: "data"; id: string; priority: number }>
  | Readonly<{ ordinal: number; kind: "opaque" }>;

/** Snapshot arrays/data are owned; opaque foreign iteration is retained without freezing. */
export type NightStagePlan =
  | Readonly<{
      mode: "snapshot";
      stages: readonly NightStageHandler[];
      metadata: readonly NightStageMetadata[];
    }>
  | Readonly<{
      mode: "opaque";
      stages: Iterable<NightStageHandler>;
      metadata: readonly NightStageMetadata[];
    }>;

/** Inspect plain numeric data without pulling a foreign iterator or index accessor. */
function snapshotMembers(source: NightStageHandler[]): NightStageHandler[] | null {
  if (
    types.isProxy(source) ||
    !Array.isArray(source) ||
    Object.getPrototypeOf(source) !== Array.prototype ||
    Object.getOwnPropertyDescriptor(source, Symbol.iterator) !== undefined
  )
    return null;
  const iterator = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator),
    values = Object.getOwnPropertyDescriptor(Array.prototype, "values");
  if (
    !iterator ||
    !("value" in iterator) ||
    !values ||
    !("value" in values) ||
    typeof iterator.value !== "function" ||
    iterator.value !== values.value
  )
    return null;
  const length = Object.getOwnPropertyDescriptor(source, "length");
  if (!length || !("value" in length)) return null;
  const members: NightStageHandler[] = [];
  for (let index = 0; index < length.value; index++) {
    const entry = Object.getOwnPropertyDescriptor(source, String(index));
    if (!entry || !("value" in entry)) return null;
    members.push(entry.value);
  }
  return members;
}

function describeStage(stage: NightStageHandler, ordinal: number): NightStageMetadata {
  if (
    stage !== null &&
    (typeof stage === "object" || typeof stage === "function") &&
    !types.isProxy(stage)
  ) {
    const id = Object.getOwnPropertyDescriptor(stage, "id"),
      priority = Object.getOwnPropertyDescriptor(stage, "priority");
    if (
      id &&
      "value" in id &&
      typeof id.value === "string" &&
      priority &&
      "value" in priority &&
      typeof priority.value === "number"
    )
      return Object.freeze({ ordinal, kind: "data", id: id.value, priority: priority.value });
  }
  return Object.freeze({ ordinal, kind: "opaque" });
}

/** 夜间阶段注册表。 */
export class NightStageRegistry {
  readonly roleCatalog: RoleCatalog;

  constructor(roleProfileRegistry: RoleCatalog = getDefaultRoleCatalog()) {
    this.roleCatalog = roleProfileRegistry;
  }

  /** Snapshot safe native membership; preserve virtual overrides and opaque lazy sources. */
  getPlan(config: BoardConfig, world?: World): NightStagePlan {
    const source = this.getStages(config, world),
      members = snapshotMembers(source);
    if (members === null)
      return Object.freeze({ mode: "opaque", stages: source, metadata: Object.freeze([]) });
    const stages = Object.freeze(members);
    const metadata = Object.freeze(stages.map(describeStage));
    return Object.freeze({ mode: "snapshot", stages, metadata });
  }

  getStages(config: BoardConfig, world?: World): NightStageHandler[] {
    const roleSet = new Set<Role>(config.roleSetups.map((item) => item.role));
    let hasRoleChecks = false;
    for (const role of [...roleSet])
      for (const kind of this.roleCatalog.get(role)?.possibleNightAbilities ?? []) {
        roleSet.add(abilityRole[kind]);
        if (kind === "role_check") hasRoleChecks = true;
      }
    for (const id of world?.entityIds() ?? [])
      for (const ability of allNightAbilities(world!.getComponent(id, COMPONENT.Role))) {
        roleSet.add(abilityRole[ability.kind]);
        if (ability.kind === "role_check") hasRoleChecks = true;
      }
    const collected: NightStageHandler[] = [];
    if (world && demonHunterActorId(world) !== null) collected.push(DEMON_HUNTER_NIGHT_STAGE);
    if (
      [...roleSet].some((role) =>
        this.roleCatalog.get(role)?.possibleDeathAbilities?.includes("gun"),
      ) ||
      world
        ?.getAliveEntityIds()
        .some((id) =>
          allDeathGuns(world.getComponent(id, COMPONENT.Role)).some(
            (gun) => gun.armedOnNight === null && !gun.disabled && !gun.deathExpired,
          ),
        )
    )
      collected.push(DEATH_ABILITY_ACTIVATION_STAGE);
    for (const role of roleSet.values()) {
      const pack = this.roleCatalog.get(role)?.nightStages ?? [];
      collected.push(...pack);
    }
    if (hasRoleChecks || collected.some((stage) => stage.id === "role_inspection"))
      collected.push(ROLE_INSPECTION_STAGE, PSYCHIC_INSPECTION_STAGE, MIRROR_INSPECTION_STAGE);
    if (
      world
        ?.entityIds()
        .some((id) =>
          allNightAbilities(world.getComponent(id, COMPONENT.Role)).some(
            (ability) => ability.activation === "lucky",
          ),
        )
    )
      collected.push(LUCKY_ABILITY_STAGE);
    if (
      world
        ?.entityIds()
        .some((id) =>
          allNightAbilities(world.getComponent(id, COMPONENT.Role)).some(
            (ability) => ability.activation === "black_market",
          ),
        )
    )
      collected.push(BLACK_MARKET_RECIPIENT_STAGE);
    const dedup = registerNightStages(collected);
    if (roleSet.has(Role.GhostBride)) {
      applyGhostBrideStageRegistration(dedup, WEDDING_CHAT_STAGE, WEDDING_KNIFE_STAGE);
    }
    return Array.from(dedup.values()).sort((a, b) => {
      const diff = a.priority - b.priority;
      if (diff !== 0) {
        return diff;
      }
      return a.id.localeCompare(b.id);
    });
  }
}

let defaultRegistry: NightStageRegistry | null = null;

/** 获取默认夜间阶段注册表实例。 */
export function getDefaultNightStageRegistry(): NightStageRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new NightStageRegistry();
  }
  return defaultRegistry;
}
