/**
 * 负责原生双爪与受传单爪的死亡行动：每单位独立捕获资格、请求、付款与已付提案。
 * 首次真实死亡及其遗言／警徽／后代动作由引擎完整结算后，单次不透明继续点才开放下一爪。
 * 本族不递归结算、不控制阶段或判胜；第二次失败保留第一付款与死亡，原生命／来源失效拒绝继续。
 * 时点是原死亡波逐人钩子及完整后代结算后的续步；权限仅含本族库存付款、具名死亡选择与追加提案。
 */
import {
  Camp,
  DeathCause,
  type DeathSources,
  type GameEvent,
} from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_CLAW_POLICY,
  AWAKENED_WOLF_KING_ROLE_ID,
} from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import { COMPONENT } from "../../domain/components/names";
import { aliveLifeVersion } from "../../domain/components/alive";
import { livingNightLife } from "../../domain/night-effects";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import {
  ownDeathHook,
  type OwnedDeathCommands,
  type OwnedDeathHookBindingSource,
} from "../../engine/hooks/owned-bindings";
import { createDeathActionContinuation } from "../../engine/hooks/death-action-continuation";
import type { DeathHookContext, DeathHookResult } from "../../engine/hooks/registry";
import { ownedAwakenedClaws, nextClawStatus, replaceAwakenedClaws } from "./state";

function empty(): DeathHookResult {
  return { extraDeaths: [], extraDeathSources: {} };
}
function qualifiedSources(values: readonly DeathCause[]): boolean {
  return (
    values.length > 0 &&
    values.every((cause) =>
      [DeathCause.WolfKill, DeathCause.Exile, DeathCause.Shot].includes(cause),
    )
  );
}

async function resolveClaws(
  source: OwnedDeathHookBindingSource,
  ids: number[],
  sources: DeathSources,
  context?: DeathHookContext,
): Promise<DeathHookResult> {
  const world = source.world,
    actorId = ids[0];
  if (actorId === undefined || ids.length !== 1) return empty();
  let state = ownedAwakenedClaws(world, actorId);
  if (!state || !state.units.some((unit) => unit.status === "ready")) return empty();
  const role = world.getComponent(actorId, COMPONENT.Role),
    camp = world.getComponent(actorId, COMPONENT.Camp),
    life = world.getComponent(actorId, COMPONENT.Alive),
    day = context?.day;
  if (
    !role ||
    !camp ||
    camp.camp !== Camp.Wolf ||
    !life ||
    life.alive ||
    aliveLifeVersion(life) === undefined ||
    day === undefined
  )
    return empty();
  const version = aliveLifeVersion(life),
    roleId = role.role,
    container = role.privateState,
    causeIdentity = JSON.stringify(sources[actorId] ?? []);
  const native = state.units[0]!.source.kind === "native";
  if (
    (native && String(roleId) !== AWAKENED_WOLF_KING_ROLE_ID) ||
    (!native && String(roleId) !== "wolf")
  )
    return empty();
  const originalCurrent = () =>
    (context?.isCurrent?.() ?? true) &&
    ownedAwakenedClaws(world, actorId) !== undefined &&
    world.getComponent(actorId, COMPONENT.Role) === role &&
    role.role === roleId &&
    role.privateState === container &&
    !isRoleExecutionRetired(role) &&
    world.getComponent(actorId, COMPONENT.Camp) === camp &&
    camp.camp === Camp.Wolf &&
    world.getComponent(actorId, COMPONENT.Alive) === life &&
    !life.alive &&
    aliveLifeVersion(life) === version &&
    JSON.stringify(sources[actorId] ?? []) === causeIdentity;
  if (!originalCurrent()) return empty();
  if (!qualifiedSources(sources[actorId] ?? [])) {
    const expired = state.units.filter((unit) => unit.status === "ready").map((unit) => unit.id);
    for (const id of expired) {
      if (!originalCurrent() || ownedAwakenedClaws(world, actorId) !== state)
        throw new Error("awakened_claw_expiry_stale");
      const next = nextClawStatus(state, id, "expired");
      replaceAwakenedClaws(role, state, next);
      state = next;
    }
    source.events.push({
      timestamp: Date.now(),
      type: "awakened_claws_expired",
      payload: { policy: AWAKENED_CLAW_POLICY, actorId, day, unitIds: expired },
      audience: Object.freeze([]),
    });
    return empty();
  }
  const step = async (): Promise<DeathHookResult> => {
    const stock = ownedAwakenedClaws(world, actorId),
      unit = stock?.units.find((entry) => entry.status === "ready");
    if (!originalCurrent() || !stock || !unit) throw new Error("awakened_claw_death_revoked");
    const eligible = () =>
      originalCurrent() &&
      ownedAwakenedClaws(world, actorId) === stock &&
      stock.units.find((entry) => entry.id === unit.id)?.status === "ready";
    const selection = await source.chooseDeathShot(actorId, unit.id, {
      nativePolicy: "awa_qualified_sources_v1",
      permissionCurrent: eligible,
      eligible,
    });
    const delivery = selection.kind === "invalid" ? undefined : selection.requestDelivery;
    let failed = false;
    try {
      if (!eligible() || selection.kind === "invalid")
        throw new Error("awakened_claw_shot_invalid");
      if (!delivery?.current()) throw new Error("awakened_claw_request_revoked");
      if (!world.isDeathActionOpen(actorId, "shoot", selection.deathActionId, unit.id))
        throw new Error("awakened_claw_shot_revoked");
      const target = selection.kind === "shot" ? selection.targetScope : null;
      if (
        selection.kind === "shot" &&
        (!target ||
          target.id !== selection.targetId ||
          target.id === actorId ||
          !livingNightLife(world, target) ||
          selection.mappingCurrent?.() === false)
      )
        throw new Error("awakened_claw_target_stale");
      const paid = nextClawStatus(stock, unit.id, "spent");
      if (!eligible() || !delivery.current()) throw new Error("awakened_claw_shot_revoked");
      // 资格／交付查询也可能使原目标失效；所有外部 guard 之后再核原生命与映射，随后才扣库存。
      if (
        target &&
        ((selection.kind === "shot" && selection.mappingCurrent?.() === false) ||
          !livingNightLife(world, target))
      )
        throw new Error("awakened_claw_target_stale");
      // 此处唯一付款；此后的保护、发表或第二次请求异常均保留已付前缀。
      replaceAwakenedClaws(role, stock, paid, target);
      delivery.complete();
      const targetId = target?.id ?? null;
      source.events.push({
        timestamp: Date.now(),
        type: "awakened_claw_spent",
        payload: { policy: AWAKENED_CLAW_POLICY, day, actorId, unitId: unit.id, targetId },
        audience: Object.freeze([actorId]),
      });
      const result = empty();
      if (target) {
        const paidCurrent = () => originalCurrent() && ownedAwakenedClaws(world, actorId) === paid;
        if (!paidCurrent()) throw new Error("awakened_claw_paid_revoked");
        const blocked = context?.nightEffect && context.blocksNightShot(target.id);
        if (!paidCurrent() || !livingNightLife(world, target))
          throw new Error("awakened_claw_paid_target_stale");
        if (blocked) {
          source.events.push({
            timestamp: Date.now(),
            type: "death_shot_blocked",
            payload: { actorId, targetId: target.id, reason: "night_protection" },
          });
        } else {
          if (!paidCurrent() || !livingNightLife(world, target))
            throw new Error("awakened_claw_paid_target_stale");
          const event: GameEvent = {
            timestamp: Date.now(),
            type: "player_shot",
            payload: { actorId, targetId: target.id },
          };
          result.extraDeaths.push(target.id);
          result.extraDeathSources[target.id] = [DeathCause.Shot];
          if (context?.nightEffect) result.nightEffectTargets = [target.id];
          result.pendingShots = [{ targetScope: target, event, isCurrent: paidCurrent }];
        }
      }
      if (paid.units.some((entry) => entry.status === "ready"))
        result.deathActionContinuations = [createDeathActionContinuation(step)];
      return result;
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      try {
        delivery?.close();
      } catch (error) {
        if (!failed) throw error;
      }
    }
  };
  return step();
}

export const AWAKENED_CLAW_DEATH_HOOK = ownDeathHook<OwnedDeathCommands>(
  (runtime, ids, sources, _choose, context) => runtime.ports.resolve(ids, sources, context),
  (source) => ({ resolve: (ids, sources, context) => resolveClaws(source, ids, sources, context) }),
);
