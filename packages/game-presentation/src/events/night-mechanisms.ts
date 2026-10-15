/**
 * 负责双端夜间机制事件的展示映射。输入是事件类型、契约 reader 接收的纯数据和语言；输出为两语自然文案，保持名单／死因顺序与未知回退。Node 入站的 Proxy 拒绝仍属于后端，浏览器 reader 不承诺任意外来对象零 trap；此处不执行夜间规则或发布事实。
 */
import type { MessageKey } from "@ai-werewolf-arena/game-contract";
import { readNobleSecretBodyFact } from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
import { readFragrantPairFact } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import { readRadiantEclipseFact } from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import { readMistRavenFact } from "@ai-werewolf-arena/game-contract/facts/mist-raven";
import {
  readModifierChoiceFact,
  readModifierSkipFact,
  readModifierConflictFact,
  readModifierBonusFact,
} from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
import {
  readTimeConsortChoiceFact,
  readTimeConsortSkipFact,
  readTimeConsortReflectionFact,
} from "@ai-werewolf-arena/game-contract/facts/time-wolf-consort";
import {
  readWolfSorcererExchangeFact,
  readWolfSorcererSkipFact,
} from "@ai-werewolf-arena/game-contract/facts/wolf-sorcerer";
import {
  readTricksterExchangeFact,
  readTricksterSkipFact,
  readExileMappingFact,
} from "@ai-werewolf-arena/game-contract/facts/trickster";
import { readOrderPrinceChoiceFact } from "@ai-werewolf-arena/game-contract/facts/order-prince";
import {
  readRedMoonNextNightFact,
  readRedMoonExpiryFact,
} from "@ai-werewolf-arena/game-contract/facts/red-moon";
import { type Locale } from "@ai-werewolf-arena/game-contract";
import {
  readDemonHunterEventFact,
  readDemonHunterPlayerFact,
} from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import {
  readNightmareFearFact,
  readNightmareOwnFearFact,
} from "@ai-werewolf-arena/game-contract/facts/nightmare";
import {
  readMagicianExchangeFact,
  readMagicianOwnExchangeFact,
  readDeathShotMissFact,
} from "@ai-werewolf-arena/game-contract/facts/magician";
import { readOrderPrinceRevoteFact } from "@ai-werewolf-arena/game-contract/facts/order-prince";
import { text } from "@ai-werewolf-arena/game-text";
import { deathCauses, deathDetails, factList, factPlayer, factPlayers } from "./fact-details";

export function demonHunterEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  const full = readDemonHunterEventFact(type, payload),
    own = readDemonHunterPlayerFact(type, payload);
  if (!full && !own) return null;
  if (type === "demon_hunter_chosen") {
    const p = (full ?? own)! as { day: number; targetId: number | null; actorId?: number };
    return text(locale, full ? "console.demon_hunter.chosen" : "console.demon_hunter.own", {
      day: p.day,
      target: p.targetId === null ? text(locale, "replay.none") : p.targetId,
      ...(full ? { actor: p.actorId! } : {}),
    });
  }
  if (type === "demon_hunter_cancelled") {
    const p =
      full as import("@ai-werewolf-arena/game-contract/facts/demon-hunter").DemonHunterCancelFact;
    return text(locale, "console.demon_hunter.cancelled", {
      actor: p.actorId,
      day: p.day,
      target: p.targetId,
      fault: p.faultId ?? text(locale, "replay.none"),
    });
  }
  const p =
    full as import("@ai-werewolf-arena/game-contract/facts/demon-hunter").DemonHunterPoisonImmuneFact;
  return text(locale, "console.demon_hunter.poison_immune", {
    actor: p.actorId,
    day: p.day,
    witch: p.witchId,
  });
}

export function nightmareEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const full = readNightmareFearFact(type, payload);
  const own = readNightmareOwnFearFact(type, payload);
  const fact = full ?? own;
  if (!fact) return null;
  const target = fact.targetId ?? text(locale, "console.nightmare.pass");
  return full
    ? text(locale, "console.nightmare.fear", { actor: full.actorId, day: full.day, target })
    : text(locale, "console.nightmare.own", { day: fact.day, target });
}

export function redMoonEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const next = readRedMoonNextNightFact(type, payload);
  if (next)
    return text(
      locale,
      type === "red_moon_night_sealed" ? "console.red_moon.seal" : "console.red_moon.exile",
      {
        actor: next.actorId,
        night: next.night,
      },
    );
  const expiry = readRedMoonExpiryFact(type, payload);
  return expiry
    ? text(locale, "console.red_moon.expiry", { actor: expiry.actorId, day: expiry.day })
    : null;
}

export function magicianEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const miss = readDeathShotMissFact(type, payload);
  if (miss) return text(locale, "console.shot.missed", { actor: miss.actorId });
  const full = readMagicianExchangeFact(type, payload),
    own = readMagicianOwnExchangeFact(type, payload),
    fact = full ?? own;
  if (!fact) return null;
  const pair = fact.pair ? fact.pair.join(", ") : text(locale, "console.magician.pass");
  return full
    ? text(locale, "console.magician.exchange", { actor: full.actorId, day: full.day, pair })
    : text(locale, "console.magician.own", { day: fact.day, pair });
}

export function orderPrinceEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "order_prince_choice_committed") {
    const fact = readOrderPrinceChoiceFact(type, payload);
    return fact
      ? text(locale, "event.order_prince_choice_committed", {
          day: fact.day,
          choice: text(
            locale,
            fact.activate ? "console.order_prince.activate" : "console.order_prince.decline",
          ),
        })
      : text(locale, "replay.unknown");
  }
  if (type !== "order_prince_revote_started") return null;
  const fact = readOrderPrinceRevoteFact(type, payload);
  return fact
    ? text(locale, "event.order_prince_revote_started", { actor: fact.actorId })
    : text(locale, "replay.unknown");
}

export function tricksterEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "trickster_exchange_committed") {
    const f = readTricksterExchangeFact(type, payload);
    return f
      ? text(locale, "event.trickster_exchange_committed", {
          actor: f.actorId,
          day: f.day,
          pair: f.pair ? f.pair.join(", ") : text(locale, "console.magician.pass"),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "trickster_exchange_skipped") {
    const f = readTricksterSkipFact(type, payload);
    return f
      ? text(
          locale,
          f.reason === "dead"
            ? "event.trickster_skipped_dead"
            : "event.trickster_skipped_exhausted",
          { actor: f.actorId, day: f.day },
        )
      : text(locale, "replay.unknown");
  }
  if (type === "exile_target_mapped") {
    const f = readExileMappingFact(type, payload);
    return f
      ? text(locale, f.missed ? "event.exile_mapping_missed" : "event.exile_target_mapped", {
          requested: f.requestedId,
          effective: f.effectiveId,
        })
      : text(locale, "replay.unknown");
  }
  return null;
}

export function wolfSorcererEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "wolf_sorcerer_exchange_committed") {
    const f = readWolfSorcererExchangeFact(type, payload);
    return f
      ? text(locale, "event.wolf_sorcerer_exchange_committed", {
          actor: f.actorId,
          day: f.day,
          pair: f.pair ? f.pair.join(", ") : text(locale, "console.magician.pass"),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "wolf_sorcerer_exchange_skipped") {
    const f = readWolfSorcererSkipFact(type, payload);
    return f
      ? text(
          locale,
          f.reason === "dead"
            ? "event.wolf_sorcerer_skipped_dead"
            : f.reason === "not_started"
              ? "event.wolf_sorcerer_skipped_not_started"
              : "event.wolf_sorcerer_skipped_exhausted",
          { actor: f.actorId, day: f.day },
        )
      : text(locale, "replay.unknown");
  }
  return null;
}

export function timeConsortEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "time_consort_lock_committed") {
    const f = readTimeConsortChoiceFact(type, payload);
    return f
      ? text(locale, "event.time_consort_lock_committed", {
          actor: f.actorId,
          day: f.day,
          target: f.targetId ?? text(locale, "console.magician.pass"),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "time_consort_lock_skipped") {
    const f = readTimeConsortSkipFact(type, payload);
    return f
      ? text(
          locale,
          f.reason === "dead"
            ? "event.time_consort_skipped_dead"
            : "event.time_consort_skipped_exhausted",
          { actor: f.actorId, day: f.day },
        )
      : text(locale, "replay.unknown");
  }
  if (type === "time_consort_reflected") {
    const f = readTimeConsortReflectionFact(type, payload);
    return f
      ? text(locale, "event.time_consort_reflected", {
          actor: f.actorId,
          day: f.day,
          source: f.sourceId,
          target: f.requestedId,
          effective: f.effectiveId,
          skill: text(
            locale,
            f.kind === "check"
              ? "time_consort.skill.check"
              : f.kind === "guard"
                ? "time_consort.skill.guard"
                : "time_consort.skill.poison",
          ),
        })
      : text(locale, "replay.unknown");
  }
  return null;
}

export function scholarMentorEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "modifier_choice_committed") {
    const f = readModifierChoiceFact(type, payload);
    return f
      ? text(locale, "event.modifier_choice", {
          actor: f.actorId,
          day: f.day,
          mode:
            f.mode === null
              ? text(locale, "modifier.pass")
              : text(locale, f.mode === "enhance" ? "modifier.enhance" : "modifier.weaken"),
          target: f.targetId ?? text(locale, "modifier.pass"),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "modifier_choice_skipped") {
    const f = readModifierSkipFact(type, payload);
    return f
      ? text(locale, "event.modifier_skip", {
          actor: f.actorId,
          day: f.day,
          reason: text(
            locale,
            f.reason === "first_night"
              ? "modifier.first_night"
              : f.reason === "dead"
                ? "modifier.dead"
                : "modifier.exhausted",
          ),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "modifier_conflict_resolved") {
    const f = readModifierConflictFact(type, payload);
    return f
      ? text(locale, "event.modifier_conflict", {
          day: f.day,
          target: f.targetId,
          kind: text(
            locale,
            f.kind === "same_good" ? "modifier.same_good" : "modifier.both_wolves",
          ),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "modifier_bonus_resolved") {
    const f = readModifierBonusFact(type, payload);
    if (!f) return text(locale, "replay.unknown");
    const skill = text(
      locale,
      f.kind === "check"
        ? "modifier.check"
        : f.kind === "guard"
          ? "modifier.guard"
          : f.kind === "poison"
            ? "modifier.poison"
            : "modifier.kill",
    );
    return (
      text(locale, "event.modifier_bonus", {
        actor: f.actorId,
        day: f.day,
        skill,
        target: f.targetId ?? text(locale, "modifier.pass"),
      }) +
      (f.kind === "check" && !f.abstain
        ? text(locale, f.isWerewolf ? "modifier.result_wolf" : "modifier.result_good")
        : "")
    );
  }
  return null;
}

export function mistRavenEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const fact = readMistRavenFact(type, payload);
  if (!fact) return null;
  const key = `event.${type}` as MessageKey;
  if ("candidates" in fact)
    return text(locale, key, {
      day: fact.day,
      candidates: fact.candidates.join(", ") || text(locale, "common.none"),
      target: fact.targetId ?? text(locale, "common.none"),
    });
  const common = { day: fact.day, actor: fact.actorId };
  if ("targetIds" in fact)
    return text(locale, key, {
      ...common,
      targets: fact.targetIds?.join(", ") ?? text(locale, "common.none"),
    });
  if ("knownTeammateIds" in fact)
    return text(locale, key, {
      ...common,
      teammates: fact.knownTeammateIds.join(", ") || text(locale, "common.none"),
    });
  if ("reason" in fact)
    return text(locale, key, {
      ...common,
      reason: text(locale, `mist.reason.${fact.reason}`),
    });
  return text(locale, key, { ...common, target: fact.targetId ?? text(locale, "common.none") });
}

export function radiantEclipseEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const fact = readRadiantEclipseFact(type, payload);
  if (!fact) return null;
  if ("playerId" in fact) return text(locale, `event.${type}` as MessageKey);
  if ("status" in fact)
    return text(
      locale,
      fact.status === "committed" ? "event.eclipse_lease_committed" : "event.eclipse_lease_aborted",
      { day: fact.day },
    );
  return text(
    locale,
    type === "eclipse_swallowed"
      ? fact.targetId === null
        ? "event.eclipse_swallow_passed"
        : "event.eclipse_swallowed"
      : fact.targetId === null
        ? "event.radiant_shelter_passed"
        : "event.radiant_shelter_used",
    fact.targetId === null
      ? { actor: fact.actorId }
      : { actor: fact.actorId, target: fact.targetId },
  );
}

export function nobleSecretBodyEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const f = readNobleSecretBodyFact(type, payload);
  if (!f) return null;
  const key = `event.${type}` as MessageKey;
  if (type === "noble_body_native_damage_committed") return text(locale, key, { day: f.day });
  if (type === "noble_body_knife_committed" && "targetId" in f)
    return text(locale, key, { day: f.day, target: f.targetId ?? text(locale, "common.none") });
  if ("notifiedActorIds" in f) return text(locale, key, { day: f.day });
  // 此处只提交最终伤害来源，尚未标死；文案不能提前宣布这些玩家已经死亡。
  if ("deathSources" in f)
    return text(locale, key, {
      day: f.day,
      deaths: deathDetails(f.deaths, f.deathSources, locale),
      blocked:
        f.blocked === null
          ? text(locale, "common.none")
          : deathDetails([f.blocked.targetId], { [f.blocked.targetId]: [f.blocked.cause] }, locale),
    });
  if ("causes" in f)
    return text(locale, key, {
      actor: f.actorId,
      day: f.day,
      causes: deathCauses(f.causes, locale),
    });

  if (type === "secret_body_revealed") return text(locale, key, { actor: f.actorId });
  if ("text" in f) return text(locale, key, { actor: f.actorId, text: f.text });
  if ("resource" in f)
    return text(locale, key, {
      actor: f.actorId,
      day: f.day,
      resource: text(locale, `secret_body.resource.${f.resource}`),
    });
  if ("contracts" in f)
    return text(locale, key, {
      actor: f.actorId,
      day: f.day,
      state: factList(
        f.contracts.map((contract) => {
          const status = text(locale, `noble.contract.${contract.status.kind}`);
          return text(locale, "noble.contract.summary", {
            target: factPlayer(contract.targetId, locale),
            created: contract.createdNight,
            expires: contract.expiresNight,
            status:
              contract.status.kind === "pending"
                ? status
                : text(locale, "noble.contract.closed_on", { day: contract.status.day, status }),
          });
        }),
        locale,
      ),
    });
  if ("status" in f)
    return text(locale, key, {
      day: f.day,
      created: f.createdNight,
      target: f.targetId,
      status: text(locale, `noble.contract.${f.status}`),
    });
  if ("cause" in f)
    return text(locale, key, {
      actor: f.actorId,
      day: f.day,
      target: f.targetId,
      cause: deathCauses([f.cause], locale),
    });
  return text(locale, key, {
    actor: f.actorId,
    day: f.day,
    target: ("targetId" in f ? f.targetId : null) ?? text(locale, "common.none"),
  });
}

export function fragrantPairEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const f = readFragrantPairFact(type, payload);
  if (!f) return null;
  const base = { actor: f.actorId, day: f.day };
  if ("knowledgeDrawCount" in f) return text(locale, "event.fragrant_night_opened", { day: f.day });
  if ("deaths" in f)
    return text(locale, "event.fragrant_wave_committed", {
      actor: f.actorId,
      day: f.day,
      deaths: deathDetails(f.deaths, f.deathSources, locale),
    });
  if ("known" in f)
    return text(locale, "event.fragrant_night_notified", {
      ...base,
      wolf: factPlayer(f.known.knownWolfId, locale),
      choice:
        f.known.lastChoice === null
          ? text(locale, "common.none")
          : text(locale, "event.night_choice", {
              day: f.known.lastChoice.day,
              target:
                f.known.lastChoice.pairIds === null
                  ? text(locale, "fragrant.choice.pass")
                  : factPlayers(f.known.lastChoice.pairIds, locale),
            }),
      used: text(locale, f.known.used ? "common.used" : "common.unused"),
      notices: factList(
        f.known.knifeNotices.map((notice) =>
          text(locale, "fragrant.knife_notice", {
            day: notice.day,
            eligible: text(
              locale,
              notice.eligible ? "console.animal.available" : "console.animal.unavailable",
            ),
          }),
        ),
        locale,
      ),
    });
  if ("containsWerewolf" in f)
    return text(locale, "event.fragrant_pair_inspected", {
      ...base,
      first: f.targetIds[0],
      second: f.targetIds[1],
      result: text(locale, f.containsWerewolf ? "fragrant.result.true" : "fragrant.result.false"),
    });
  if ("rootId" in f)
    return text(locale, "event.fragrant_link_triggered", {
      ...base,
      first: f.pairIds[0],
      second: f.pairIds[1],
      root: f.rootId,
      added: f.addedTargetId ?? text(locale, "fragrant.trigger.no_addition"),
    });
  if ("createdNight" in f)
    return text(locale, "event.fragrant_binding_expired", {
      ...base,
      created: f.createdNight,
      first: f.pairIds[0],
      second: f.pairIds[1],
    });
  return text(locale, "event.fragrant_pair_chosen", {
    ...base,
    targets: f.pairIds?.join(", ") ?? text(locale, "fragrant.choice.pass"),
  });
}
