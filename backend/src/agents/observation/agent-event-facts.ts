/**
 * 负责为已由 Node 验证为 inert 的事件选择一次家族读器，并保存该次解析的事实。
 * 输入必须来自反射前拒绝 Proxy 的事件快照；这里不重新扫描未知宿主对象。
 * 事实联合按实际读器标识关联其输出类型。授权与裁字段使用同一个结果，不缓存 World、回调或玩家身份。
 * sourceEvent 保留可信自定义规则的原参数；schema 家族的输出由已解析事实固定，回调不能换掉授权依据。
 * 无 schema 家族仍沿用既有字段裁剪和可信回调语义；历史 audience 不根据当前阵营重算。
 */
import {
  ANIMAL_DREAM_EVENT_TYPES,
  readAnimalDreamFact,
} from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import {
  NOBLE_SECRET_BODY_EVENT_TYPES,
  readNobleSecretBodyFact,
} from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
import {
  FRAGRANT_PAIR_EVENT_TYPES,
  readFragrantPairFact,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import {
  RADIANT_ECLIPSE_EVENT_TYPES,
  readRadiantEclipseFact,
} from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import {
  MIST_RAVEN_EVENT_TYPES,
  readMistRavenFact,
} from "@ai-werewolf-arena/game-contract/facts/mist-raven";
import {
  readWolfSorcererExchangeFact,
  readWolfSorcererSkipFact,
} from "@ai-werewolf-arena/game-contract/facts/wolf-sorcerer";
import {
  readTricksterExchangeFact,
  readTricksterSkipFact,
  readExileMappingFact,
} from "@ai-werewolf-arena/game-contract/facts/trickster";
import {
  readOrderPrinceChoiceFact,
  readOrderPrinceRevoteFact,
} from "@ai-werewolf-arena/game-contract/facts/order-prince";
import {
  readMagicianExchangeFact,
  readDeathShotMissFact,
} from "@ai-werewolf-arena/game-contract/facts/magician";
import {
  readRedMoonNextNightFact,
  readRedMoonExpiryFact,
} from "@ai-werewolf-arena/game-contract/facts/red-moon";
import { readNightmareFearFact } from "@ai-werewolf-arena/game-contract/facts/nightmare";
import {
  DEMON_HUNTER_EVENT_TYPES,
  readDemonHunterEventFact,
} from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import {
  GHOST_BRIDE_EVENT_TYPES,
  readGhostBrideEventFact,
} from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { readLonelyGirlEventFact } from "@ai-werewolf-arena/game-contract/facts/lonely-girl";
import {
  WILD_CHILD_EVENT_TYPES,
  readWildChildEventFact,
} from "@ai-werewolf-arena/game-contract/facts/wild-child";
import {
  SHAPESHIFTER_EVENT_TYPES,
  readShapeshifterEventFact,
} from "@ai-werewolf-arena/game-contract/facts/shapeshifter";
import {
  THIEF_EVENT_TYPES,
  readThiefEventFact,
} from "@ai-werewolf-arena/game-contract/facts/thief";
import {
  WALL_EVENT_TYPES,
  readWallEventFact,
} from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import {
  readCupidEventFact,
  CUPID_EVENT_TYPES,
} from "@ai-werewolf-arena/game-contract/facts/cupid";
import {
  readDebateEventFact,
  DEBATE_EVENT_TYPES,
} from "@ai-werewolf-arena/game-contract/facts/debate";
import {
  readModifierChoiceFact,
  readModifierSkipFact,
  readModifierBonusFact,
} from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
import {
  readTimeConsortChoiceFact,
  readTimeConsortSkipFact,
} from "@ai-werewolf-arena/game-contract/facts/time-wolf-consort";
import { readCrowFact } from "@ai-werewolf-arena/game-contract";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";

/** 仅描述 Node 已验证且已脱离宿主引用的数据，不是行动许可或未知输入的安全断言。 */
declare const inertAgentEvent: unique symbol;
export type InertAgentEvent = GameEvent & { readonly [inertAgentEvent]: true };

import {
  SILENCE_ELDER_EVENT_TYPES,
  readSilenceElderFact,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
const FACT_READERS = {
  readSilenceElderFact,
  readCrowFact,
  readAnimalDreamFact,
  readNobleSecretBodyFact,
  readFragrantPairFact,
  readRadiantEclipseFact,
  readMistRavenFact,
  readWolfSorcererExchangeFact,
  readWolfSorcererSkipFact,
  readTricksterExchangeFact,
  readTricksterSkipFact,
  readExileMappingFact,
  readOrderPrinceChoiceFact,
  readOrderPrinceRevoteFact,
  readMagicianExchangeFact,
  readDeathShotMissFact,
  readRedMoonNextNightFact,
  readRedMoonExpiryFact,
  readNightmareFearFact,
  readDemonHunterEventFact,
  readGhostBrideEventFact,
  readLonelyGirlEventFact,
  readWildChildEventFact,
  readShapeshifterEventFact,
  readThiefEventFact,
  readWallEventFact,
  readCupidEventFact,
  readDebateEventFact,
  readModifierChoiceFact,
  readModifierSkipFact,
  readModifierBonusFact,
  readTimeConsortChoiceFact,
  readTimeConsortSkipFact,
};
export type AgentEventFactReader = keyof typeof FACT_READERS;
type FactResult<K extends AgentEventFactReader> = ReturnType<(typeof FACT_READERS)[K]>;
/** 标识与事实类型一起保存，禁止用宽 payload 字典掩盖家族字段关系。 */
export type AgentEventFact = {
  [K in AgentEventFactReader]: { readonly reader: K; readonly value: NonNullable<FactResult<K>> };
}[AgentEventFactReader];

export interface PreparedAgentEvent {
  /** 同一个 inert 副本只交给既有 trusted 可见性回调；不回读宿主事件。 */
  readonly sourceEvent: InertAgentEvent;
  /** undefined 表示没有家族 schema；null 表示该家族事实无效。 */
  readonly fact: AgentEventFact | null | undefined;
  /** 有 schema 时 payload 来自该次解析，无 schema 时保留同一个副本。 */
  readonly projectionEvent: GameEvent;
}

/** 家族分派集中在这里；选择唯一实际读器，不先后试读同一个 payload。 */
function factReader(type: GameEvent["type"]): AgentEventFactReader | null {
  if ((SILENCE_ELDER_EVENT_TYPES as readonly string[]).includes(type))
    return "readSilenceElderFact";
  if ((ANIMAL_DREAM_EVENT_TYPES as readonly string[]).includes(type)) return "readAnimalDreamFact";
  if ((FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(type))
    return "readFragrantPairFact";
  if ((NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(type))
    return "readNobleSecretBodyFact";
  if ((RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(type))
    return "readRadiantEclipseFact";
  if ((MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(type)) return "readMistRavenFact";
  if ((CUPID_EVENT_TYPES as readonly string[]).includes(type)) return "readCupidEventFact";
  if ((DEBATE_EVENT_TYPES as readonly string[]).includes(type)) return "readDebateEventFact";
  if ((WALL_EVENT_TYPES as readonly string[]).includes(type)) return "readWallEventFact";
  if ((THIEF_EVENT_TYPES as readonly string[]).includes(type)) return "readThiefEventFact";
  if ((WILD_CHILD_EVENT_TYPES as readonly string[]).includes(type)) return "readWildChildEventFact";
  if ((SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(type))
    return "readShapeshifterEventFact";
  if ((GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(type))
    return "readGhostBrideEventFact";
  if ((DEMON_HUNTER_EVENT_TYPES as readonly string[]).includes(type))
    return "readDemonHunterEventFact";
  switch (type) {
    case "lonely_girl_admired_chosen":
      return "readLonelyGirlEventFact";
    case "crow_curse_chosen":
    case "crow_curse_applied":
      return "readCrowFact";
    case "nightmare_fear_committed":
      return "readNightmareFearFact";
    case "red_moon_night_sealed":
      return "readRedMoonNextNightFact";
    case "red_moon_exile_delayed":
      return "readRedMoonNextNightFact";
    case "red_moon_delay_expired":
      return "readRedMoonExpiryFact";
    case "magician_exchange_committed":
      return "readMagicianExchangeFact";
    case "death_shot_missed":
      return "readDeathShotMissFact";
    case "order_prince_revote_started":
      return "readOrderPrinceRevoteFact";
    case "order_prince_choice_committed":
      return "readOrderPrinceChoiceFact";
    case "trickster_exchange_committed":
      return "readTricksterExchangeFact";
    case "trickster_exchange_skipped":
      return "readTricksterSkipFact";
    case "exile_target_mapped":
      return "readExileMappingFact";
    case "wolf_sorcerer_exchange_committed":
      return "readWolfSorcererExchangeFact";
    case "wolf_sorcerer_exchange_skipped":
      return "readWolfSorcererSkipFact";
    case "modifier_choice_committed":
      return "readModifierChoiceFact";
    case "modifier_choice_skipped":
      return "readModifierSkipFact";
    case "modifier_bonus_resolved":
      return "readModifierBonusFact";
    case "time_consort_lock_committed":
      return "readTimeConsortChoiceFact";
    case "time_consort_lock_skipped":
      return "readTimeConsortSkipFact";
    default:
      return null;
  }
}

/** 只在唯一 Node 快照后调用；返回值没有外部回调、运行句柄或后续解析任务。 */
export function prepareInertAgentEvent(event: InertAgentEvent): PreparedAgentEvent {
  const reader = factReader(event.type);
  if (!reader) return { sourceEvent: event, fact: undefined, projectionEvent: event };
  const parse = FACT_READERS[reader];
  const value = parse(event.type, event.payload);
  if (!value) return { sourceEvent: event, fact: null, projectionEvent: event };
  // reader 与 value 在同一次调用中关联；联合由该标识导航，不能把事实当成任意字典。
  const fact = { reader, value } as AgentEventFact;
  const payload =
    fact.reader === "readAnimalDreamFact" || fact.reader === "readSilenceElderFact"
      ? fact.value.payload
      : fact.value;
  // 原家族读器已经深复制 payload；这里只复制元信息（尤其是历史 audience），不重复复制事实。
  // canonical 标识和受众不得与交给可信回调的 sourceEvent 共用可变数组。
  const { payload: _sourcePayload, ...metadata } = event;
  const projectionEvent = { ...structuredClone(metadata), payload } as GameEvent;
  return { sourceEvent: event, fact, projectionEvent };
}

/**
 * 兼容路径仍在原位置调用原读器；prepared 路径只取同一解析结果。
 * 泛型返回关联由 reader 的判别检查保证；没有匹配家族时返回原读器的 null 结果。
 */
export function readAgentEventFact<K extends AgentEventFactReader>(
  reader: K,
  type: string,
  payload: unknown,
  prepared: PreparedAgentEvent | undefined,
): FactResult<K> {
  if (prepared) {
    return (prepared.fact?.reader === reader ? prepared.fact.value : null) as FactResult<K>;
  }
  const parse = FACT_READERS[reader];
  return parse(type, payload) as FactResult<K>;
}
