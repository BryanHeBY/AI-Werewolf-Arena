/**
 * 负责暗夜星辰及觉醒骑士原板的具名致死准备：已付全天盾先挡原提案，未挡才付狼美人替死，替身再核盾。
 * 输入为DR原名单／来源／根阶段、原生命及已付巡猎内存提案；输出同容器的实际名单和本批原生命检查范围。
 * 资源付款仍归本族，真实标死、词徽、追加波与最终判胜仍归引擎。本组合不复活、不改原票目标，
 * 也不提供任意角色callback或通用事务。日志失败保已经支付前缀，公开结果只在实际commit之后发表。
 */
import {
  DeathCause,
  Phase,
  type EntityId,
  type DeathSources,
  type GameEvent,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import { AWAKENED_BEAUTY_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import { AWAKENED_PATROL_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import type { World } from "../domain/world";
import { captureNightLife, type NightLifeScope } from "../domain/night-effects";
import type { DeathOriginalLife } from "../engine/death-wave";
import {
  prepareProtectionBlock,
  hasAwakenedGuardFrame,
} from "../features/awakened-guard/protection-ports";
import { AWAKENED_GUARD_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import {
  payAwakenedBeautyReplacement,
  readPaidBeautyReplacement,
  beautyReplacementTargetCurrent,
  hasAwakenedBeautyFrame,
  type PaidBeautyReplacement,
} from "../features/awakened-wolf-beauty/ports";
import { paidAwakenedPatrol, type PaidPatrolProposal } from "../features/awakened-hunter/ports";

export function hasAwakenedDeathPrevention(world: World): boolean {
  return hasAwakenedBeautyFrame(world) || hasAwakenedGuardFrame(world);
}
export interface AwakenedDeathPreparationRuntime {
  readonly world: World;
  readonly day: number;
  readonly phase: Phase;
  readonly events: GameEvent[];
  isCurrent(): boolean;
}
export interface AwakenedPreparedDeaths {
  readonly lives: ReadonlyMap<EntityId, DeathOriginalLife>;
  /** actualIds只能由本次真实commit返回；付款／选择事实不等于实际死亡。 */
  publishAfterCommit(actualIds: ReadonlySet<EntityId>): void;
}
const mapGet = Map.prototype.get,
  mapHas = Map.prototype.has,
  apply = Reflect.apply;
/** 新owner路径使用同一原体；若无显式原life，则在真实提案准备点捕获，不在付款后改捕新body。 */
function scopeFor(
  world: World,
  id: EntityId,
  originals: ReadonlyMap<EntityId, DeathOriginalLife> | undefined,
): NightLifeScope {
  if (originals) {
    if (types.isProxy(originals) || !types.isMap(originals))
      throw new Error("awakened_death_original_lives_invalid");
    if (apply(mapHas, originals, [id])) {
      const original = apply(mapGet, originals, [id]);
      if (!original || typeof original !== "object" || types.isProxy(original))
        throw new Error("awakened_death_original_lives_invalid");
      const life = Object.getOwnPropertyDescriptor(original, "life")?.value,
        version = Object.getOwnPropertyDescriptor(original, "version")?.value;
      if (!life || typeof version !== "number" || !Number.isSafeInteger(version) || version < 0)
        throw new Error("awakened_death_original_lives_invalid");
      return { id, life, version };
    }
  }
  const scope = captureNightLife(world, id);
  if (!scope) throw new Error("awakened_death_target_unavailable");
  return scope;
}
export function prepareAwakenedDeaths(
  runtime: AwakenedDeathPreparationRuntime,
  ids: EntityId[],
  sources: DeathSources,
  rootPhases: Map<EntityId, Phase>,
  originals?: ReadonlyMap<EntityId, DeathOriginalLife>,
  patrols: readonly PaidPatrolProposal[] = [],
): AwakenedPreparedDeaths {
  const { world, day, phase, events } = runtime;
  if (!hasAwakenedDeathPrevention(world)) throw new Error("awakened_death_preparation_unavailable");
  const patrolByTarget = new Map<
    EntityId,
    { proposal: PaidPatrolProposal; data: NonNullable<ReturnType<typeof paidAwakenedPatrol>> }
  >();
  // 先核全部owned来源，再做任何资源/事实写。伪造cause或复制JSON不能获得夜根抑制／死亡权。
  for (const proposal of patrols) {
    const data = paidAwakenedPatrol(world, proposal, day);
    if (
      !data ||
      patrolByTarget.has(data.target.id) ||
      !ids.includes(data.target.id) ||
      !sources[data.target.id]?.includes(DeathCause.AwakenedPatrol) ||
      rootPhases.get(data.target.id) !== data.rootPhase
    )
      throw new Error("awakened_patrol_proposal_invalid");
    patrolByTarget.set(data.target.id, { proposal, data });
  }
  for (const id of ids)
    if (sources[id]?.includes(DeathCause.AwakenedPatrol) && !patrolByTarget.has(id))
      throw new Error("awakened_patrol_proposal_invalid");
  // 替死原因只能由本组合支付并产生，不接受外部hook凭JSON直接指定另一个受害者。
  if (ids.some((id) => sources[id]?.includes(DeathCause.AwakenedBeautyReplacement)))
    throw new Error("awakened_beauty_replacement_proposal_invalid");
  const blocked = (scope: NightLifeScope, root: Phase, causes: readonly DeathCause[]) => {
    const receipt = prepareProtectionBlock(world, day, scope, phase, root, causes);
    if (!receipt) return false;
    const publish = events.push,
      detail: GameEvent = {
        timestamp: Date.now(),
        type: "awakened_protection_block_detail",
        payload: { policy: AWAKENED_GUARD_POLICY, ...receipt },
        audience: Object.freeze([]),
      },
      notice: GameEvent = {
        timestamp: Date.now(),
        type: "awakened_protection_blocked",
        payload: { policy: AWAKENED_GUARD_POLICY, day, targetId: scope.id },
      },
      detailArgs: [GameEvent] = [detail],
      noticeArgs: [GameEvent] = [notice],
      invoke = Reflect.apply.bind(Reflect);
    if (!runtime.isCurrent()) throw new Error("awakened_death_preparation_revoked");
    // sink/时钟与外部当前性都先读完；首真实阻挡写前再核同一已付原体盾。
    // 首事实成功后再发生日终保留阻挡前缀，不把当时尚未生效的决定倒灌为历史保护。
    if (!prepareProtectionBlock(world, day, scope, phase, root, receipt.causes)) return false;
    invoke(publish, events, detailArgs);
    invoke(publish, events, noticeArgs);
    return true;
  };
  const scopes = new Map<EntityId, NightLifeScope>(),
    retained: EntityId[] = [],
    originalsIn = [...ids];
  for (const id of originalsIn) {
    const scoped = patrolByTarget.get(id)?.data.target ?? scopeFor(world, id, originals);
    scopes.set(id, scoped);
    if (blocked(scoped, rootPhases.get(id) ?? phase, sources[id] ?? [])) {
      delete sources[id];
      continue;
    }
    retained.push(id);
  }
  const independent = new Set(retained),
    actual: EntityId[] = [],
    lives = new Map<EntityId, DeathOriginalLife>(),
    replacements: PaidBeautyReplacement[] = [],
    mapped = new Map<EntityId, EntityId | null>();
  for (const id of retained) {
    if (!runtime.isCurrent()) throw new Error("awakened_death_preparation_revoked");
    const scope = scopes.get(id)!,
      root = rootPhases.get(id) ?? phase;
    const paid = payAwakenedBeautyReplacement(
      world,
      day,
      phase,
      root,
      scope,
      sources[id] ?? [],
      independent,
      patrolByTarget.get(id)?.proposal,
      () => runtime.isCurrent(),
    );
    if (!paid) {
      actual.push(id);
      lives.set(id, { life: scope.life, version: scope.version });
      mapped.set(id, id);
      continue;
    }
    const replacement = readPaidBeautyReplacement(world, paid, day)!;
    replacements.push(paid);
    events.push({
      timestamp: Date.now(),
      type: "awakened_beauty_replacement_paid",
      payload: {
        policy: AWAKENED_BEAUTY_POLICY,
        actorId: id,
        day,
        targetId: replacement.target.id,
        phase,
        rootPhase: root,
        preventedCauses: [...replacement.causes],
      },
      audience: Object.freeze([]),
    });
    delete sources[id];
    if (!beautyReplacementTargetCurrent(world, paid, day))
      throw new Error("awakened_beauty_replacement_target_stale");
    if (blocked(replacement.target, root, [DeathCause.AwakenedBeautyReplacement])) {
      mapped.set(id, null);
      continue;
    }
    const targetId = replacement.target.id;
    actual.push(targetId);
    sources[targetId] = [DeathCause.AwakenedBeautyReplacement];
    rootPhases.set(targetId, root);
    lives.set(targetId, { life: replacement.target.life, version: replacement.target.version });
    mapped.set(id, targetId);
  }
  if (!runtime.isCurrent()) throw new Error("awakened_death_preparation_revoked");
  ids.splice(0, ids.length, ...actual);
  for (const id of originalsIn) if (!actual.includes(id)) rootPhases.delete(id);
  let published = false;
  return {
    lives,
    publishAfterCommit(actualIds) {
      if (published) throw new Error("awakened_death_publication_already_attempted");
      published = true;
      for (const receipt of replacements) {
        const paid = readPaidBeautyReplacement(world, receipt, day)!;
        if (paid.rootPhase !== Phase.Night)
          events.push({
            timestamp: Date.now(),
            type: "awakened_beauty_replaced",
            payload: {
              policy: AWAKENED_BEAUTY_POLICY,
              day,
              actorId: paid.actorId,
              targetId: paid.target.id,
              targetDied: actualIds.has(paid.target.id),
            },
          });
      }
      for (const { data } of patrolByTarget.values()) {
        const actualTarget = mapped.get(data.target.id),
          targetId = actualTarget && actualIds.has(actualTarget) ? actualTarget : null;
        events.push({
          timestamp: Date.now(),
          type: "awakened_patrol_resolved",
          payload: {
            policy: AWAKENED_PATROL_POLICY,
            day,
            actorId: data.actorId,
            direction: data.direction,
            targetId,
          },
        });
      }
    },
  };
}
