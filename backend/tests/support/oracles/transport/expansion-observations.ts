/**
 * 测试支持层负责新增角色的实际玩家feed断言，再将旧事件交原不可变oracle；手写受众政策为预期。
 * 原fixture与其已登记声明保持不动，新协议驱动显式选此组合；不改manifest摘要、不重算游戏规则。
 * 新事实先完整核格式及隐私后剔出旧验证输入，仅给旧oracle映射等价基础阵营名，真实计划和档案不改。
 */
import {
  readAwakenedBeautyFact,
  AWAKENED_BEAUTY_EVENT_TYPES,
} from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import {
  readAwakenedPatrolFact,
  AWAKENED_PATROL_EVENT_TYPES,
} from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import { readCrowFact } from "@ai-werewolf-arena/game-contract/facts/crow";
import {
  readSilenceElderFact,
  SILENCE_ELDER_EVENT_TYPES,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { readWardenFact, WARDEN_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/warden";
import {
  readAwakenedClawFact,
  AWAKENED_CLAW_EVENT_TYPES,
} from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import {
  readAwakenedWitchFact,
  isAwakenedWitchEventType,
} from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import {
  readAwakenedGuardFact,
  isAwakenedGuardEventType,
} from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import {
  readAwakenedDuelFact,
  isAwakenedDuelEventType,
} from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import { assertTransportEvents } from "./observations";
import type {
  MistWireExpectations,
  MistWireState,
} from "../../features/mist-raven/oracles/transport";
type Event = [number, string, Record<string, unknown>];
const groups = new WeakMap<object, Map<number, readonly number[]>>();
function check(value: unknown): asserts value {
  if (!value) throw Error("fixture_expansion_private_fact_exposed");
}
export function assertExpansionTransportEvents(
  role: string,
  events: Event[],
  actorId: number,
  expected?: MistWireExpectations,
  state?: MistWireState,
): void {
  const owner = state ?? {},
    known = groups.get(owner) ?? new Map<number, readonly number[]>(),
    native: Event[] = [];
  groups.set(owner, known);
  for (const event of events) {
    const [, type, payload] = event;
    if (isAwakenedGuardEventType(type)) {
      const f = readAwakenedGuardFact(type, payload);
      check(
        f && !["awakened_protection_block_detail", "awakened_protection_expired"].includes(f.type),
      );
      if (f.type === "awakened_guard_cycle_started" || f.type === "awakened_protection_chosen")
        check(role === "awakened_guard" && f.payload.actorId === actorId);
    } else if (isAwakenedDuelEventType(type)) {
      check(readAwakenedDuelFact(type, payload));
    } else if ((AWAKENED_BEAUTY_EVENT_TYPES as readonly string[]).includes(type)) {
      const f = readAwakenedBeautyFact(type, payload);
      check(f && f.type !== "awakened_beauty_replacement_paid");
      if (f.type === "awakened_charm_chosen")
        check(role === "awakened_wolf_beauty" && f.payload.actorId === actorId);
    } else if ((AWAKENED_PATROL_EVENT_TYPES as readonly string[]).includes(type)) {
      const f = readAwakenedPatrolFact(type, payload);
      check(f);
      if (f.type === "awakened_patrol_paid")
        check(role === "awakened_hunter" && f.payload.actorId === actorId);
    } else if (isAwakenedWitchEventType(type)) {
      const f = readAwakenedWitchFact(type, payload);
      check(f && f.type !== "brew_resolved");
      if (f.type === "awakened_brew_chosen")
        check(role === "awakened_witch" && f.payload.actorId === actorId);
      else {
        check(role !== "awakened_witch");
        if (f.type === "brew_started") {
          check(f.payload.assistantIds.includes(actorId));
          known.set(f.payload.day, f.payload.assistantIds);
        } else {
          check(known.get(f.payload.day)?.includes(actorId));
          if (f.type === "brew_approval") check(f.payload.actorId === actorId);
          else check(known.get(f.payload.day)?.includes(f.payload.actorId));
        }
      }
    } else if ((AWAKENED_CLAW_EVENT_TYPES as readonly string[]).includes(type)) {
      const f = readAwakenedClawFact(type, payload);
      check(f && f.type !== "awakened_claws_expired");
      check(
        f.payload.actorId === actorId ||
          (f.type === "awakened_claw_bequeathed" && f.payload.targetId === actorId),
      );
    } else if ((WARDEN_EVENT_TYPES as readonly string[]).includes(type)) {
      const f = readWardenFact(type, payload);
      check(f && f.type !== "warden_resolved" && f.payload.actorId === actorId);
      if (f.type === "warden_pair_chosen") check(role === "warden");
    } else if ((SILENCE_ELDER_EVENT_TYPES as readonly string[]).includes(type)) {
      const f = readSilenceElderFact(type, payload);
      check(f && f.type !== "silence_expired");
      if (f.type === "silence_chosen")
        check(role === "silence_elder" && f.payload.actorId === actorId);
    } else if (type === "crow_curse_chosen" || type === "crow_curse_applied") {
      const f = readCrowFact(type, payload);
      check(f);
      if (type === "crow_curse_chosen") check(role === "crow" && payload.actorId === actorId);
    } else native.push(event);
    if (typeof payload.day === "number" && state?.currentDay !== undefined)
      check(payload.day <= state.currentDay);
  }
  const aliases: Record<string, string> = {
    warden: "wolf",
    awakened_wolf_king: "wolf_king",
    awakened_wolf_beauty: "wolf_beauty",
    awakened_hunter: "hunter",
    awakened_guard: "guard",
    awakened_knight: "knight",
  };
  assertTransportEvents(aliases[role] ?? role, native, actorId, expected, state);
}
