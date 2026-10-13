/**
 * 负责动物梦境完整死亡波贡献：装配实际运行端口、过滤白猫、公布事实、猫到期及提交事实。
 * 输入为原名单、可写原因表和来源阶段，以及保原晚读的运行／权威／事实端口；
 * 输出为原有效死亡名单、原因表修改及初／追加波事实。运行装配不向玩家暴露 World 或库存写权。
 * 已公布猫事实与已删原因属于原失败前缀，后续到期或记录失败不回滚，也不修改 Alive 或扩展其他关系。
 * 规则依据：docs/expansion/rules/awa-animal-dream-twelve-v1.md。
 */
import { Phase, DeathCause, type EntityId, type DeathSources } from "../../../../core/domain/model";
import {
  filterAnimalLethalWave,
  animalAuthoritySnapshot,
  isAnimalDreamBoard,
  prepareAnimalCatExpiry,
} from "./authority";
import { appendAnimalFact } from "./facts";
import { COMPONENT } from "../../../../core/domain/components/names";
import { Role, type GameEvent } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";

/** 只捕获结算器；每个 World／事件读取仍在原规则或事实参数位置，不缓存生命／权威快照。 */
export interface AnimalDeathWaveRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}
import type { AnimalDreamPayloadMap } from "@ai-werewolf-arena/game-contract/facts/animal-dream";

type PreparationFact =
  "animal_wave_prepared" | "animal_cat_revealed" | "animal_cat_expiry_prepared";
/** 每个 thunk 在旧 World/事件参数之后才读取 unit 或构造 payload，避免 getter 提前。 */
interface AnimalDeathWavePorts {
  filter(
    day: number,
    phase: "night" | "day" | "voting",
    ids: EntityId[],
    sources: DeathSources,
    scope: () => object | (() => boolean),
  ): ReturnType<typeof filterAnimalLethalWave>;
  authority(): ReturnType<typeof animalAuthoritySnapshot>;
  prepareExpiry(unit: () => object): number | null;
  appendFact<T extends PreparationFact>(type: T, payload: () => AnimalDreamPayloadMap[T]): void;
}

export class AnimalDeathWavePreparation {
  constructor(
    private readonly ownsAnimal: boolean,
    private readonly resolutionDay: number,
    private readonly nightEffects: { animalUnit?: object } | undefined,
    private readonly isCurrent: () => boolean,
    private readonly ports: AnimalDeathWavePorts,
    private readonly runtime?: AnimalDeathWaveRuntime,
  ) {}

  /** 实际生产装配由动物 owner 完成；旧显式端口构造仅保留已有子系统调用契约。 */
  static fromRuntime(
    runtime: AnimalDeathWaveRuntime,
    resolutionDay: number,
    nightEffects: { animalUnit?: object } | undefined,
    isCurrent: () => boolean,
  ): AnimalDeathWavePreparation {
    const ownsAnimal = isAnimalDreamBoard(runtime.world);
    return new AnimalDeathWavePreparation(
      ownsAnimal,
      resolutionDay,
      nightEffects,
      isCurrent,
      {
        filter: (day, phase, ids, sources, scope) =>
          filterAnimalLethalWave(runtime.world, day, phase, ids, sources, scope()),
        authority: () => animalAuthoritySnapshot(runtime.world),
        prepareExpiry: (unit) => prepareAnimalCatExpiry(runtime.world, unit()),
        appendFact: (type, payload) =>
          appendAnimalFact(runtime.world, runtime.events, type, payload()),
      },
      runtime,
    );
  }

  /** 与原开局谓词同一次判断；后续仍由 prepare 和具体权威验证当前性，不增加镜像。 */
  get enabled(): boolean {
    return this.ownsAnimal;
  }

  /** 初波已实际标死且原公开通知已执行；河豚底牌先于整波事实，失败不回滚死亡或前一事实。 */
  recordInitialWave(pending: EntityId[], allSources: DeathSources, deathPhase: Phase): void {
    const resolutionDay = this.resolutionDay;
    for (const id of pending)
      if (
        this.runtime!.world.getComponent(id, COMPONENT.Role)?.role === Role.Pufferfish &&
        (allSources[id] ?? []).includes(DeathCause.WolfKill)
      )
        appendAnimalFact(this.runtime!.world, this.runtime!.events, "animal_puffer_revealed", {
          policy: "awa_animal_dream_v1",
          day: resolutionDay,
          actorId: id,
          reason: "knife_death",
        });
    appendAnimalFact(this.runtime!.world, this.runtime!.events, "animal_wave_committed", {
      policy: "awa_animal_dream_v1",
      day: resolutionDay,
      phase: deathPhase as "night" | "day" | "voting",
      deaths: [...pending],
      deathSources: Object.fromEntries(
        pending.map((id) => [String(id), [...(allSources[id] ?? [])]]),
      ),
    });
  }

  /** 追加目标标死后立即记录同一来源集合；随后才进入原 shot 发布、关系通知和继承顺序。 */
  recordAdditionalDeath(id: EntityId, allSources: DeathSources, sourcePhase: Phase): void {
    const resolutionDay = this.resolutionDay;
    appendAnimalFact(this.runtime!.world, this.runtime!.events, "animal_wave_committed", {
      policy: "awa_animal_dream_v1",
      day: resolutionDay,
      phase: sourcePhase as "night" | "day" | "voting",
      deaths: [id],
      deathSources: { [String(id)]: [...(allSources[id] ?? [])] },
    });
  }

  prepare(ids: EntityId[], waveSources: DeathSources, sourcePhase: Phase): EntityId[] {
    const { ownsAnimal, resolutionDay, nightEffects, isCurrent, ports } = this;
    if (!ownsAnimal) return ids;
    const proposed = [...ids],
      filtered = ports.filter(
        resolutionDay,
        sourcePhase as "night" | "day" | "voting",
        ids,
        waveSources,
        () => nightEffects?.animalUnit ?? isCurrent,
      );
    ports.appendFact("animal_wave_prepared", () => ({
      policy: "awa_animal_dream_v1",
      day: resolutionDay,
      phase: sourcePhase as "night" | "day" | "voting",
      proposedIds: proposed,
      blockedCatId: filtered.blockedCatId,
    }));
    if (filtered.revealedCatId !== null)
      ports.appendFact("animal_cat_revealed", () => ({
        policy: "awa_animal_dream_v1",
        day: resolutionDay,
        actorId: filtered.revealedCatId!,
      }));
    // 白猫首次挡死只留历史；到期仅沿用本单位新的放逐／河豚来源，不恢复首次死因枪权。
    const actual = [...filtered.deaths],
      cat = filtered.blockedCatId,
      currentCatSources =
        cat === null
          ? []
          : (waveSources[cat] ?? []).filter(
              (c) => c === DeathCause.Exile || c === DeathCause.PufferRetaliation,
            );
    // 原揭示事实先公布；之后删被过滤猫的原因，后续到期失败不回滚这个前缀。
    if (cat !== null) delete waveSources[cat];
    if (nightEffects?.animalUnit && !ports.authority()!.unit!.expiryPrepared) {
      // 必须先读原 World，再读取当次 unit；不能提前缓存两次 animalUnit getter。
      const expiry = ports.prepareExpiry(() => nightEffects.animalUnit!);
      if (expiry !== null) {
        const u = ports.authority()!.unit!;
        ports.appendFact("animal_cat_expiry_prepared", () => ({
          policy: "awa_animal_dream_v1",
          day: resolutionDay,
          actorId: expiry,
          unit: u.number,
          unitKind: u.kind,
        }));
        if (!actual.includes(expiry)) actual.push(expiry);
        // 按旧原因→本单位原因→到期原因合并，Set 只去重，不重新排序。
        waveSources[expiry] = [
          ...new Set([
            ...(waveSources[expiry] ?? []),
            ...currentCatSources,
            DeathCause.WhiteCatExpiry,
          ]),
        ];
      }
    }
    return actual;
  }
}
