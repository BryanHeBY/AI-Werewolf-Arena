/**
 * 负责原生死亡钩子完成之后的赠与／转移死亡枪行动。输入为原死亡玩家、合格死因和当前首死枪；
 * 输出为追加死亡、来源、夜目标及立即／延期枪事件。请求后先核执行资格与死亡许可，消费先于保护和事实，
 * 执行权限由原 gun scope／死亡行动窗口核对，已付 pending 只保原 scope.isCurrent 原体复验；
 * 不重新授枪，晚事件失败不退款，也不让模型预检付款。
 */
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { DeathCause, permitsHunterShot } from "../../domain/model";
import { captureNightLife, livingNightLife } from "../../domain/night-effects";
import type { DeathHook } from "../../engine/hooks/registry";
import {
  ownDeathHook,
  type OwnedHookBindingSource,
  type OwnedDeathCommands,
} from "../../engine/hooks/owned-bindings";
import {
  activeDeathGun,
  allDeathGuns,
  captureDeathGun,
  consumeDeathGunShot,
} from "./death-abilities";

/** 原生角色死亡钩子依次返回之后，每名玩家读取其首个转移／赠与枪；不在此重新安装或补充库存。 */
async function resolveOwnedDeath(
  source: OwnedHookBindingSource,
  ids: Parameters<DeathHook>[1],
  sources: Parameters<DeathHook>[2],
  choose: Parameters<DeathHook>[3],
  context: Parameters<DeathHook>[4],
): ReturnType<DeathHook> {
  const world = source.world,
    events = source.events;
  const result = {
    extraDeaths: [] as number[],
    extraDeathSources: {} as Record<number, DeathCause[]>,
    pendingShots: [] as NonNullable<
      import("../../engine/hooks/registry").DeathHookResult["pendingShots"]
    >,
    nightEffectTargets: [] as number[],
  };
  for (const actorId of ids) {
    const current = () => context?.isCurrent?.() ?? true;
    if (!current()) break;
    const gun = allDeathGuns(world.getComponent(actorId, COMPONENT.Role))[0];
    if (!gun || !permitsHunterShot(sources[actorId] ?? [])) continue;
    const resolutionDay = context?.day;
    if (
      resolutionDay === null ||
      resolutionDay === undefined ||
      activeDeathGun(world, actorId, gun.id, resolutionDay, true) !== gun
    )
      continue;
    const scope = captureDeathGun(world, actorId, gun, resolutionDay, current),
      targets = new Map(world.getAliveEntityIds().map((id) => [id, captureNightLife(world, id)!]));
    const selected = await choose(actorId, gun.id);
    if (
      !scope.isEligible() ||
      selected.kind === "invalid" ||
      !world.isDeathActionOpen(actorId, "shoot", selected.deathActionId, gun.id)
    )
      continue;
    if (selected.kind === "pass") {
      consumeDeathGunShot(gun);
      continue;
    }
    const target = selected.targetScope ?? targets.get(selected.targetId);
    if (!target || target.id !== selected.targetId || !livingNightLife(world, target)) continue;
    // 此刻已消费；保护判断、提案与事件随后执行，pending.current 不能变回未付执行资格。
    consumeDeathGunShot(gun);
    if (context?.nightEffect && context.blocksNightShot(target.id)) {
      events.push({
        timestamp: Date.now(),
        type: "death_shot_blocked",
        payload: { actorId, targetId: target.id, reason: "night_protection" },
      });
      continue;
    }
    const event = {
      timestamp: Date.now(),
      type: "player_shot" as const,
      payload: { actorId, targetId: target.id },
    };
    result.extraDeaths.push(target.id);
    result.extraDeathSources[target.id] = [DeathCause.Shot];
    if (context?.nightEffect) result.nightEffectTargets.push(target.id);
    if (context?.deferShotCommit)
      result.pendingShots.push({ targetScope: target, event, isCurrent: scope.isCurrent });
    else events.push(event);
  }
  return result;
}

/** 本族运行hook只得到具体结算命令；cold绑定不查询名单、库存或World。 */
export const giftGunDeathHook: DeathHook = ownDeathHook<OwnedDeathCommands>(
  (runtime, ids, sources, choose, context) => runtime.ports.resolve(ids, sources, choose, context),
  (source) => ({
    resolve: (
      ids: Parameters<DeathHook>[1],
      sources: Parameters<DeathHook>[2],
      choose: Parameters<DeathHook>[3],
      context: Parameters<DeathHook>[4],
    ) => resolveOwnedDeath(source, ids, sources, choose, context),
  }),
);
