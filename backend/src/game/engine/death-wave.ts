/**
 * 负责死亡波的运行时提交输入与提交凭证结构。输入为已有名单、死因、来源阶段和原生命证据；
 * 输出只读计划及与唯一生命账本同引用的凭证，不重查 World、资格、时钟或库存。
 * 计划只引用调用方已有集合，不创建第二套 seen／原因／枪库存；凭证不是死亡行动授权。
 * 发布关联留在凭证内部，绝不修改事件、原 Alive 或归档形状；失败不生成成功凭证。
 */
import { types } from "node:util";
import type { AliveComponent } from "../../core/domain/components/alive";
import {
  DeathCause,
  Phase,
  type DeathSources,
  type EntityId,
} from "@ai-werewolf-arena/game-contract";
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import type { NightPoisonRoute } from "../../core/domain/night_effects";

export interface DeathOriginalLife {
  readonly life: Readonly<AliveComponent>;
  readonly version: number | undefined;
}

/** 只在实际初始波／角色追加 proposal 打开时创建；逐目标提交及再次访问复用此身份。 */
export interface DeathWaveUnit {
  readonly id: symbol;
  readonly kind: "initial" | "additional" | "legacy";
  readonly day: number | undefined;
  readonly actionPhase: Phase | undefined;
}

export function openDeathWave(
  kind: DeathWaveUnit["kind"],
  day?: number,
  actionPhase?: Phase,
): DeathWaveUnit {
  return Object.freeze({ id: Symbol("death_wave"), kind, day, actionPhase });
}

/** 来源集合可继续由结算器按原位置扩展；只读接口不冻结 live 原体或调用方数组。 */
export interface DeathWavePlan {
  readonly units: readonly DeathWaveUnit[];
  readonly previousCommits: readonly DeathCommitReceipt[];
  readonly kind: "initial" | "additional" | "revisit" | "legacy";
  readonly ids: readonly EntityId[];
  readonly sources: Readonly<Record<EntityId, readonly DeathCause[]>>;
  readonly originPhases?: ReadonlyMap<EntityId, Phase>;
  readonly originalLives?: ReadonlyMap<EntityId, DeathOriginalLife>;
  readonly poisonRoutes: readonly NightPoisonRoute[];
}

const nativeMapGet = Map.prototype.get;
const noPoisonMetadata: readonly NightPoisonRoute[] = Object.freeze([]);

function ownMetadataValue(input: object | undefined, key: string): unknown {
  if (typeof input !== "object" || input === null || types.isProxy(input)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/** 新元数据只消费 own-data，旧同名 getter／Proxy 不属于新增读取契约。 */
export function deathWaveOriginalLives(
  input: object | undefined,
): ReadonlyMap<EntityId, DeathOriginalLife> | undefined {
  const value = ownMetadataValue(input, "originalLives");
  return typeof value === "object" && value !== null && !types.isProxy(value) && types.isMap(value)
    ? (value as ReadonlyMap<EntityId, DeathOriginalLife>)
    : undefined;
}

/** 不迭代外来 Proxy／getter 数组；只快照普通数组的 own-data 原路由引用。 */
export function deathWavePoisonMetadata(input: object | undefined): readonly NightPoisonRoute[] {
  const value = ownMetadataValue(input, "poisonRoutes");
  if (value === undefined) return noPoisonMetadata;
  const values = dataValues(value, true);
  return values === null || values === opaque
    ? noPoisonMetadata
    : Object.freeze(
        values.filter(
          (route): route is NightPoisonRoute =>
            typeof route === "object" && route !== null && !types.isProxy(route),
        ),
      );
}

/** 原 Map 只读内部条目，不查找／调用覆盖的 get 方法；opaque 容器诊断记 unknown。 */
function mapMetadataValue<T>(
  map: ReadonlyMap<EntityId, T> | undefined,
  id: EntityId,
): T | undefined {
  return map !== undefined && !types.isProxy(map) && types.isMap(map)
    ? (nativeMapGet.call(map, id) as T | undefined)
    : undefined;
}

export interface DeathSettledLife {
  readonly component: Readonly<AliveComponent>;
  readonly version: number | undefined;
}

export interface DeathCommitEntry {
  readonly id: EntityId;
  readonly firstSettlement: boolean;
  readonly originPhase: Phase | undefined;
  readonly originalLife: DeathOriginalLife | undefined;
  /** 正是 ledger.set 使用的原对象，不另行捕获生命版本。 */
  readonly settled: DeathSettledLife;
  /** 来自已接受伤害的原路由，只绑定同原体／版本及仍保留的毒死因；未知来源不伪造。 */
  readonly poisonRoutes: readonly NightPoisonRoute[];
  readonly units: readonly DeathWaveUnit[];
}

export interface DeathPublication {
  readonly event: GameEvent;
  readonly ids: readonly EntityId[];
}

/** 只在整次命令正常返回时存在；逐枪命令各有凭证，后续失败不撤销之前的死亡。 */
export class DeathCommitReceipt {
  private readonly publications: DeathPublication[] = [];
  constructor(
    readonly wave: DeathWavePlan,
    readonly entries: readonly DeathCommitEntry[],
  ) {}

  /** 对已提交原体的只读查询；缺项不冒充死亡，也不改旧 callback 的 pending 入参。 */
  committed(id: EntityId): DeathCommitEntry | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  /** 只保留真正仍属于该死因的接受路由；外部旧结果无路由时不制造来源。 */
  poisonRoutesFor(id: EntityId): readonly NightPoisonRoute[] {
    return this.committed(id)?.poisonRoutes ?? [];
  }

  /** 关联原事件而不读其 payload／Symbol／descriptor，兼容冻结事件和旧 Proxy。 */
  recordPublication(event: GameEvent, ids: readonly EntityId[]): void {
    if (this.publications.some((publication) => publication.event === event)) return;
    this.publications.push(Object.freeze({ event, ids: Object.freeze([...ids]) }));
  }

  publicationLinks(): readonly DeathPublication[] {
    return Object.freeze([...this.publications]);
  }
}

export function planDeathWave(
  ids: readonly EntityId[],
  sources: Readonly<Record<EntityId, readonly DeathCause[]>>,
  kind: DeathWavePlan["kind"],
  originPhases?: ReadonlyMap<EntityId, Phase>,
  originalLives?: ReadonlyMap<EntityId, DeathOriginalLife>,
  poisonRoutes: readonly NightPoisonRoute[] = [],
  units: readonly DeathWaveUnit[] = [openDeathWave("legacy")],
  previousCommits: readonly DeathCommitReceipt[] = [],
): DeathWavePlan {
  return Object.freeze({
    units: Object.freeze([...units]),
    previousCommits: Object.freeze([...previousCommits]),
    kind,
    ids,
    sources,
    originPhases,
    originalLives,
    poisonRoutes,
  });
}

/**
 * 在原 ledger.set 成功之后生成证据；只消费已读原体／版本，不查询 alive 值或任何 World。
 * 来源 metadata 不授予资格：旧路由缺失／外来 getter／复活后的版本不匹配时仅记 unknown。
 */
export function committedDeathEntry(
  wave: DeathWavePlan | undefined,
  id: EntityId,
  firstSettlement: boolean,
  settled: DeathSettledLife,
): DeathCommitEntry {
  const routes: NightPoisonRoute[] = [];
  if (wave && wave.poisonRoutes.length && !types.isProxy(wave.sources)) {
    const source = Object.getOwnPropertyDescriptor(wave.sources, String(id));
    const causes = source && "value" in source ? dataValues(source.value, true) : null;
    if (causes !== opaque && causes?.includes(DeathCause.Poison)) {
      for (const route of wave.poisonRoutes) {
        if (types.isProxy(route)) continue;
        const targetId = Object.getOwnPropertyDescriptor(route, "targetId");
        const routeKind = Object.getOwnPropertyDescriptor(route, "route");
        const original = Object.getOwnPropertyDescriptor(route, "origin");
        if (
          !targetId ||
          !("value" in targetId) ||
          targetId.value !== id ||
          !routeKind ||
          !("value" in routeKind) ||
          (routeKind.value !== "direct" && routeKind.value !== "reflected") ||
          !original ||
          !("value" in original)
        )
          continue;
        const origin: unknown = original.value;
        if (typeof origin !== "object" || origin === null || types.isProxy(origin)) continue;
        // 用 origin 创建时锁定的源／目标字段，不把后来可变的 route.target scope 当权威。
        const body = Object.getOwnPropertyDescriptor(
          origin,
          routeKind.value === "direct" ? "targetBody" : "sourceBody",
        );
        const version = Object.getOwnPropertyDescriptor(
          origin,
          routeKind.value === "direct" ? "targetVersion" : "sourceVersion",
        );
        if (
          body &&
          "value" in body &&
          body.value === settled.component &&
          version &&
          "value" in version &&
          typeof version.value === "number" &&
          settled.version !== undefined &&
          (settled.version === version.value + 1 || settled.version === version.value)
        )
          routes.push(route);
      }
    }
  }
  const prior =
    wave?.previousCommits.flatMap((receipt) => receipt.committed(id)?.units ?? []) ?? [];
  return Object.freeze({
    id,
    firstSettlement,
    settled,
    originPhase: mapMetadataValue(wave?.originPhases, id),
    originalLife: mapMetadataValue(wave?.originalLives, id),
    poisonRoutes: Object.freeze(routes),
    units: Object.freeze(prior.length ? [...new Set(prior)] : [...(wave?.units ?? [])]),
  });
}

const validCauses = new Set<string>(Object.values(DeathCause));
const validPhases = new Set<string>(Object.values(Phase));
const opaque = Symbol("opaque_death_input");

/**
 * 仅预检普通 own-data：Proxy、getter、继承字段和自定义迭代器保留旧惰性读取边界。
 * 静态坏数据必须在任何 Animal／关系事实前拒绝；此检查不读取 live World 或行动权限。
 */
function dataValues(value: unknown, array: boolean): unknown[] | typeof opaque | null {
  if (typeof value !== "object" || value === null) return null;
  if (types.isProxy(value)) return opaque;
  if (array !== Array.isArray(value)) return null;
  if (
    Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype) &&
    (array || Object.getPrototypeOf(value) !== null)
  )
    return opaque;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(descriptors).some(
      (key) => typeof key !== "string" || !("value" in descriptors[key]!),
    )
  )
    return opaque;
  if (array) {
    if (Object.hasOwn(descriptors, Symbol.iterator)) return opaque;
    const length = descriptors.length!.value as number;
    const values: unknown[] = [];
    for (let i = 0; i < length; i++) {
      const descriptor = descriptors[String(i)];
      if (!descriptor) return null;
      values.push(descriptor.value);
    }
    if (
      Object.keys(descriptors).some(
        (key) => key !== "length" && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length),
      )
    )
      return null;
    return values;
  }
  if (
    Object.keys(descriptors).some(
      (key) => !/^(0|[1-9]\d*)$/.test(key) || !Number.isSafeInteger(Number(key)),
    )
  )
    return null;
  return Object.values(descriptors).map((descriptor) => descriptor.value);
}

/** 全 proposal 预检只强化 data-only 畸形输入；合法顺序、重复 ID／原因及未知 legacy 读取不改。 */
export function preflightDeathWaveData(
  ids: readonly EntityId[],
  sources: DeathSources,
  phases?: Readonly<Record<EntityId, Phase>>,
): void {
  const roots = dataValues(ids, true);
  if (
    roots !== opaque &&
    (roots === null ||
      roots.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id < 0))
  )
    throw new Error("death_wave_input_invalid: ids");
  const causes = dataValues(sources, false);
  if (causes !== opaque) {
    if (causes === null) throw new Error("death_wave_input_invalid: sources");
    for (const list of causes) {
      const values = dataValues(list, true);
      if (
        values !== opaque &&
        (values === null ||
          values.some((cause) => typeof cause !== "string" || !validCauses.has(cause)))
      )
        throw new Error("death_wave_input_invalid: causes");
    }
  }
  if (phases !== undefined) {
    const values = dataValues(phases, false);
    if (
      values !== opaque &&
      (values === null ||
        values.some((phase) => typeof phase !== "string" || !validPhases.has(phase)))
    )
      throw new Error("death_wave_input_invalid: phases");
  }
}
