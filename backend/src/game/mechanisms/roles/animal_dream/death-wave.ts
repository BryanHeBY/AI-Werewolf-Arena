/**
 * 负责动物梦境死亡波准备：过滤白猫、公布原事实、处理猫到期并按原顺序修正死亡原因。
 * 输入为原名单、可写原因表和来源阶段，以及限定的过滤、权威查询、到期提交、事实端口；
 * 输出为原有效死亡名单和原因表修改。公开接口不暴露 World、角色、库存、时钟或阶段控制。
 * 已公布猫事实与已删原因属于原失败前缀，后续到期或记录失败不回滚，也不修改 Alive 或扩展其他关系。
 * 规则依据：docs/expansion/rules/awa-animal-dream-twelve-v1.md。
 */
import { Phase, DeathCause, type EntityId, type DeathSources } from "../../../../core/domain/model";
import type { filterAnimalLethalWave, animalAuthoritySnapshot } from "./authority";
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
  ) {}

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
