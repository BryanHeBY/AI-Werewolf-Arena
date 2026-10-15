/**
 * 负责：按原算法收集、去重和排序有限夜间阶段，并标记观察到的来源。
 * 输入：只读板子、角色目录与可选当前 World；输出：原 handler 和快照或不透明模式。
 * 默认贡献的成员及潜在能力元数据交给 RulePlan 固定；collector 本身不拥有整局规则。
 * 普通原生密集数组可冻结成员，虚方法、Proxy、访问器或惰性来源保留原晚拉取及失败前缀。
 * 描述器检查不额外执行 getter，原 handler、World 和能力实例均不冻结。
 * 共享注册与鬼魂新娘替换保留原对象及先后次序，来源信息不授予行动资格。
 */
import type { NightAbilityKind } from "@ai-werewolf-arena/game-contract";

import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { demonHunterActorId } from "../features/demon-hunter/authority";
import { types } from "node:util";
import { DEMON_HUNTER_NIGHT_STAGE } from "../features/demon-hunter/night-stages";
import {
  WEDDING_CHAT_STAGE,
  WEDDING_KNIFE_STAGE,
} from "../features/ghost-bride/night-stages";
/** 文件说明：根据板子角色集合构建夜间阶段列表。 */
import { Role } from "../domain/model";
import { RoleCatalog } from "./roles/catalog";
import { getDefaultRoleCatalog } from "./roles/role-catalog-assembly";
import { NightStageHandler } from "../engine/night/contracts";
import type { World } from "../domain/world";
import { COMPONENT } from "../domain/components/names";
import { allNightAbilities } from "../features/night-abilities/abilities";

import {
  ROLE_INSPECTION_STAGE,
  PSYCHIC_INSPECTION_STAGE,
  MIRROR_INSPECTION_STAGE,
} from "../features/role-inspection/contribution-ports";
import { BLACK_MARKET_RECIPIENT_STAGE } from "../features/black-market-merchant/night-stage";
import { LUCKY_ABILITY_STAGE } from "../features/miracle-merchant/lucky-stage";
import { allDeathGuns } from "../features/death-actions/death-abilities";
import { DEATH_ABILITY_ACTIVATION_STAGE } from "../features/death-actions/death-ability-activation";
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

import type {
  NightStageMetadata,
  NightStagePlan,
  NightStageExecutionEntry,
  NightStageContributionSource,
  SupportedNightDefinition,
} from "./night-stage-plan-contracts";
export type { NightStageMetadata, NightStagePlan } from "./night-stage-plan-contracts";

const unknownOverrideSources: readonly NightStageContributionSource[] = Object.freeze([
  Object.freeze({ kind: "unknown", reason: "override" } as const),
]);
const unknownReferenceSources: readonly NightStageContributionSource[] = Object.freeze([
  Object.freeze({ kind: "unknown", reason: "unobserved-reference" } as const),
]);

/** 只包装刚拉取的 handler，外部下一次拉取仍在其执行之后发生。 */
function opaqueExecutionEntries(
  source: Iterable<NightStageHandler>,
): Iterable<NightStageExecutionEntry> {
  return Object.freeze({
    *[Symbol.iterator]() {
      for (const handler of source)
        yield Object.freeze({ handler, sources: unknownOverrideSources });
    },
  });
}

/** 原 spread 完成后才用自有数字槽附加来源，不重读外部贡献字段。 */
function rememberAppendedSources(
  collected: readonly NightStageHandler[],
  start: number,
  source: NightStageContributionSource,
  sources: Map<NightStageHandler, NightStageContributionSource[]>,
): void {
  for (let index = start; index < collected.length; index++) {
    const handler = collected[index]!;
    const original = sources.get(handler) ?? [];
    original.push(source);
    sources.set(handler, original);
  }
}

/** 只查看普通数组的数字槽描述器，不拉取外部 iterator 或调用 index getter。 */
function snapshotMembers<T>(source: T[]): T[] | null {
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
  const members: T[] = [];
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

/** 只复制自有数据描述器；不调用额外 getter，自定义贡献协议明确保持不透明。 */
function supportedProfile(
  profile: unknown,
  role: unknown,
  pack: NightStageHandler[],
): SupportedNightDefinition["roles"][number] | null {
  if (!profile || typeof profile !== "object" || types.isProxy(profile) || typeof role !== "string")
    return null;
  const prototype = Object.getPrototypeOf(profile);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(profile);
  for (const name of ["nightStages", "possibleNightAbilities", "possibleDeathAbilities"])
    if (descriptors[name] && !("value" in descriptors[name]!)) return null;
  const handlers = snapshotMembers(pack);
  const night = descriptors.possibleNightAbilities?.value ?? [];
  const death = descriptors.possibleDeathAbilities?.value ?? [];
  if (!Array.isArray(night) || !Array.isArray(death)) return null;
  const nightMembers = snapshotMembers(night),
    deathMembers = snapshotMembers(death);
  if (!handlers || !nightMembers || !deathMembers) return null;
  if (
    !nightMembers.every((kind) => typeof kind === "string") ||
    !deathMembers.every((kind) => kind === "gun")
  )
    return null;
  return Object.freeze({
    role,
    handlers: Object.freeze(handlers),
    night: Object.freeze(nightMembers as unknown as NightAbilityKind[]),
    death: Object.freeze(deathMembers as unknown as "gun"[]),
  });
}

/** 夜间阶段注册表。 */
export class NightStageRegistry {
  readonly roleCatalog: RoleCatalog;
  private readonly sourceByCollection = new WeakMap<
    object,
    Readonly<{
      sources: ReadonlyMap<NightStageHandler, readonly NightStageContributionSource[]>;
      definition: SupportedNightDefinition | null;
      builtIn: boolean;
    }>
  >();

  constructor(roleProfileRegistry: RoleCatalog = getDefaultRoleCatalog()) {
    this.roleCatalog = roleProfileRegistry;
  }

  /** 快照仅用于安全原生成员；虚方法覆盖和不透明惰性来源保留原时点。 */
  getPlan(config: ReadonlyBoardConfig, world?: World): NightStagePlan {
    const source = this.getStages(config, world),
      members = snapshotMembers(source);
    if (members === null)
      return Object.freeze({
        mode: "opaque",
        stages: source,
        entries: opaqueExecutionEntries(source),
        metadata: Object.freeze([]),
        definition: null,
        definitionScope: "injected",
      });
    const stages = Object.freeze(members);
    const metadata = Object.freeze(stages.map(describeStage));
    const collection = this.sourceByCollection.get(source);
    const sources = collection?.sources;
    const entries = Object.freeze(
      stages.map((handler) =>
        Object.freeze({
          handler,
          sources:
            sources?.get(handler) ?? (sources ? unknownReferenceSources : unknownOverrideSources),
        }),
      ),
    );
    return Object.freeze({
      mode: "snapshot",
      stages,
      entries,
      metadata,
      definition: metadata.every((row) => row.kind === "data")
        ? (collection?.definition ?? null)
        : null,
      definitionScope: collection?.builtIn ? "built-in" : "injected",
    });
  }

  getStages(config: ReadonlyBoardConfig, world?: World): NightStageHandler[] {
    const roleSet = new Set<Role>(config.roleSetups.map((item) => item.role));
    let hasRoleChecks = false;
    for (const role of [...roleSet])
      for (const kind of this.roleCatalog.runtime(role)?.possibleNightAbilities ?? []) {
        roleSet.add(abilityRole[kind]);
        if (kind === "role_check") hasRoleChecks = true;
      }
    for (const id of world?.entityIds() ?? [])
      for (const ability of allNightAbilities(world!.getComponent(id, COMPONENT.Role))) {
        roleSet.add(abilityRole[ability.kind]);
        if (ability.kind === "role_check") hasRoleChecks = true;
      }
    const collected: NightStageHandler[] = [];
    const sources = new Map<NightStageHandler, NightStageContributionSource[]>();
    // 在原 pack 读取及 spread 之后记录声明，不能为固定计划提前读取目录或玩家状态。
    const declarations: SupportedNightDefinition["roles"][number][] = [];
    let standardDefinition = this === defaultRegistry;
    if (world && demonHunterActorId(world) !== null) {
      const start = collected.length;
      collected.push(DEMON_HUNTER_NIGHT_STAGE);
      rememberAppendedSources(
        collected,
        start,
        Object.freeze({ kind: "compiler-reservation", reservation: "demon-native" }),
        sources,
      );
    }
    if (
      [...roleSet].some((role) =>
        this.roleCatalog.runtime(role)?.possibleDeathAbilities?.includes("gun"),
      ) ||
      world
        ?.getAliveEntityIds()
        .some((id) =>
          allDeathGuns(world.getComponent(id, COMPONENT.Role)).some(
            (gun) => gun.armedOnNight === null && !gun.disabled && !gun.deathExpired,
          ),
        )
    ) {
      const start = collected.length;
      collected.push(DEATH_ABILITY_ACTIVATION_STAGE);
      rememberAppendedSources(
        collected,
        start,
        Object.freeze({ kind: "compiler-reservation", reservation: "death-activation" }),
        sources,
      );
    }
    for (const role of roleSet.values()) {
      const profile = this.roleCatalog.runtime(role);
      const pack = profile?.nightStages ?? [];
      const start = collected.length;
      collected.push(...pack);
      if (standardDefinition) {
        const declaration = supportedProfile(profile, role, pack);
        if (declaration) declarations.push(declaration);
        else standardDefinition = false;
      }
      rememberAppendedSources(
        collected,
        start,
        Object.freeze(
          typeof role === "string"
            ? { kind: "role-profile", role }
            : { kind: "unknown", reason: "foreign-role" },
        ),
        sources,
      );
    }
    if (hasRoleChecks || collected.some((stage) => stage.id === "role_inspection")) {
      const start = collected.length;
      collected.push(ROLE_INSPECTION_STAGE, PSYCHIC_INSPECTION_STAGE, MIRROR_INSPECTION_STAGE);
      rememberAppendedSources(
        collected,
        start,
        Object.freeze({ kind: "compiler-reservation", reservation: "role-inspection" }),
        sources,
      );
    }
    if (
      world
        ?.entityIds()
        .some((id) =>
          allNightAbilities(world.getComponent(id, COMPONENT.Role)).some(
            (ability) => ability.activation === "lucky",
          ),
        )
    ) {
      const start = collected.length;
      collected.push(LUCKY_ABILITY_STAGE);
      rememberAppendedSources(
        collected,
        start,
        Object.freeze({ kind: "compiler-reservation", reservation: "lucky" }),
        sources,
      );
    }
    if (
      world
        ?.entityIds()
        .some((id) =>
          allNightAbilities(world.getComponent(id, COMPONENT.Role)).some(
            (ability) => ability.activation === "black_market",
          ),
        )
    ) {
      const start = collected.length;
      collected.push(BLACK_MARKET_RECIPIENT_STAGE);
      rememberAppendedSources(
        collected,
        start,
        Object.freeze({ kind: "compiler-reservation", reservation: "black-market" }),
        sources,
      );
    }
    const dedup = registerNightStages(collected);
    if (roleSet.has(Role.GhostBride)) {
      const changes = applyGhostBrideStageRegistration(
        dedup,
        WEDDING_CHAT_STAGE,
        WEDDING_KNIFE_STAGE,
      );
      for (const change of changes) {
        const prior = sources.get(change.original ?? change.handler) ?? [];
        sources.set(change.handler, [
          ...prior,
          Object.freeze({ kind: "ghost-replacement", operation: change.operation }),
        ]);
      }
    }
    const stages = Array.from(dedup.values()).sort((a, b) => {
      const diff = a.priority - b.priority;
      if (diff !== 0) {
        return diff;
      }
      return a.id.localeCompare(b.id);
    });
    const frozenSources = new Map<NightStageHandler, readonly NightStageContributionSource[]>();
    for (const [handler, contributions] of sources)
      frozenSources.set(handler, Object.freeze(contributions));
    this.sourceByCollection.set(
      stages,
      Object.freeze({
        sources: frozenSources,
        builtIn: this === defaultRegistry,
        definition: standardDefinition
          ? Object.freeze({
              roles: Object.freeze(declarations),
              // 预约仅补齐未来合法赠予/复制所需的定义，不增添当夜执行条目。
              reservations: Object.freeze([
                DEMON_HUNTER_NIGHT_STAGE,
                DEATH_ABILITY_ACTIVATION_STAGE,
                ROLE_INSPECTION_STAGE,
                PSYCHIC_INSPECTION_STAGE,
                MIRROR_INSPECTION_STAGE,
                LUCKY_ABILITY_STAGE,
                BLACK_MARKET_RECIPIENT_STAGE,
              ]),
            })
          : null,
      }),
    );
    return stages;
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
