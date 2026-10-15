/**
 * 负责发表动物梦境已验证事实，并拥有按 World 隔离的事件时点知识日志。
 * 输入为原权威事实、演员与事件数组；输出为不可变追加事实及对应玩家已知数据。
 * 不变量：仅成功发表才能更新知识，覆盖 push 不得冒充提交；God 资源查询和复制视图
 * 不消费库存、推进日志或揭示未提交结果。
 */
import { readAnimalDreamFact, animalDreamFactAudience, type AnimalDreamEventType, type AnimalDreamPayloadMap, type AnimalBeautyKnowledge } from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import { ANIMAL_DREAM_POLICY } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../../domain/world";
import { types } from "node:util";
import type { GameEvent } from "../../../../domain/events";
import { snapshotPlainData } from "../../../../domain/plain-data";
import { Camp } from "../../../../domain/identity";
import { getWolfBeautyState } from "../wolf_beauty/ports";
import { animalOriginalRolePlayer, animalOriginalPlayer } from "./roster";
import {
  animalBeautyCharmAllowed,
  animalBeautyLinkBlocked,
  animalPackKnifeBlocked,
  animalAuthoritySnapshot,
} from "./authority";
interface Knowledge {
  fox: Map<
    number,
    { remaining: 0 | 1; lastChoice: { day: number; targetId: number | null } | null }
  >;
  puffer: Map<
    number,
    { remaining: 0 | 1; lastDecision: { day: number; activate: boolean } | null }
  >;
  cats: Set<number>;
  beauty: Map<number, AnimalBeautyKnowledge>;
  bear: Array<{ day: number; roared: boolean }>;
}
const known = new WeakMap<World, Knowledge>();
const now = Date.now.bind(Date);
function freezeFactData(value: object): void {
  for (const child of Object.values(value))
    if (child !== null && typeof child === "object") freezeFactData(child);
  Object.freeze(value);
}
function journal(world: World): Knowledge {
  let k = known.get(world);
  if (!k) {
    k = { fox: new Map(), puffer: new Map(), cats: new Set(), beauty: new Map(), bear: [] };
    known.set(world, k);
  }
  return k;
}
/** 仅成功追加的事实推进知识；God 资源查询不推进。 */
export function appendAnimalFact<K extends AnimalDreamEventType>(
  world: World,
  events: GameEvent[],
  type: K,
  payload: AnimalDreamPayloadMap[K],
): void {
  const fact = readAnimalDreamFact(type, snapshotPlainData(payload));
  if (!fact) throw Error("animal_fact_invalid");
  if (
    types.isProxy(events) ||
    !Array.isArray(events) ||
    Object.getPrototypeOf(events) !== Array.prototype ||
    !Object.isExtensible(events) ||
    !Object.getOwnPropertyDescriptor(events, "length")?.writable
  )
    throw Error("animal_fact_log_invalid");
  freezeFactData(fact.payload);
  const visibility = animalDreamFactAudience(fact.type),
    actorId = "actorId" in fact.payload ? fact.payload.actorId : undefined,
    event = {
      timestamp: now(),
      type: fact.type,
      payload: fact.payload,
      ...(visibility === "actor"
        ? { audience: Object.freeze([actorId!]) }
        : visibility === "god"
          ? { audience: Object.freeze([]) }
          : {}),
    } as GameEvent;
  Object.freeze(event);
  // 经数组 own data 槽发表，覆盖的 push 不能冒充发表成功。
  Object.defineProperty(events, events.length, {
    value: event,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  const k = journal(world);
  if (fact.type === "animal_fox_chosen") {
    const p = fact.payload,
      old = k.fox.get(p.actorId);
    k.fox.set(p.actorId, {
      remaining: p.targetId === null ? (old?.remaining ?? 1) : 0,
      lastChoice: { day: p.day, targetId: p.targetId },
    });
  }
  if (fact.type === "animal_puffer_decided") {
    const p = fact.payload,
      old = k.puffer.get(p.actorId);
    k.puffer.set(p.actorId, {
      remaining: p.activate ? 0 : (old?.remaining ?? 1),
      lastDecision: { day: p.day, activate: p.activate },
    });
  }
  if (fact.type === "animal_cat_revealed") k.cats.add(fact.payload.actorId);
  if (fact.type === "animal_beauty_notified") {
    const { policy: _policy, day: _day, actorId, ...view } = fact.payload;
    k.beauty.set(actorId, view);
  }
}
export function animalFoxKnowledge(world: World, id: number) {
  return structuredClone(journal(world).fox.get(id) ?? { remaining: 1 as const, lastChoice: null });
}
export function animalPufferKnowledge(world: World, id: number) {
  return structuredClone(
    journal(world).puffer.get(id) ?? { remaining: 1 as const, lastDecision: null },
  );
}
export function animalCatKnowledge(world: World, id: number) {
  return { revealed: journal(world).cats.has(id) };
}
export function animalBeautyKnowledge(world: World, id: number): AnimalBeautyKnowledge {
  return structuredClone(
    journal(world).beauty.get(id) ?? {
      charmAllowed: true,
      linkAllowed: true,
      targetId: null,
      lastActedDay: null,
      history: [],
    },
  );
}
export function animalBearKnowledge(world: World) {
  return { history: structuredClone(journal(world).bear) };
}
/** BearNightFrame 真正追加公开事件后、任何后续请求前调用。 */
export function noteAnimalBearPublication(
  world: World,
  events: readonly GameEvent[],
  fromIndex: number,
): void {
  const k = journal(world);
  for (const e of events.slice(fromIndex))
    if (e.type === "bear_roared" && !k.bear.some((r) => r.day === e.payload.day))
      k.bear.push({ day: e.payload.day, roared: e.payload.roared });
}
export function appendAnimalBeautyNotice(world: World, events: GameEvent[], day: number): void {
  const actor = animalOriginalRolePlayer(world, "wolf_beauty");
  if (!actor || !actor.scope.life.alive) return;
  const state = getWolfBeautyState(actor.scope.role)!;
  appendAnimalFact(world, events, "animal_beauty_notified", {
    policy: ANIMAL_DREAM_POLICY,
    day,
    actorId: actor.scope.id,
    charmAllowed: animalBeautyCharmAllowed(world, day),
    linkAllowed: !animalBeautyLinkBlocked(world, day),
    targetId: state.targetId,
    lastActedDay: state.lastActedDay,
    history: state.history.map((row) => ({ ...row })),
  });
}
export function appendAnimalKnifeNotices(world: World, events: GameEvent[], day: number): void {
  const blocked = animalPackKnifeBlocked(world),
    snapshot = animalAuthoritySnapshot(world);
  if (!snapshot) throw Error("animal_authority_revoked");
  for (const id of world.entityIds()) {
    const actor = animalOriginalPlayer(world, id);
    if (actor?.scope.campValue === Camp.Wolf)
      appendAnimalFact(world, events, "animal_knife_notified", {
        policy: ANIMAL_DREAM_POLICY,
        day,
        actorId: id,
        eligible: !blocked,
      });
  }
}
