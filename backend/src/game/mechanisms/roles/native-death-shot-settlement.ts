/**
 * 负责四族原生／学习枪的完整死亡结算：死因资格、选择等待、原体复验、付款与追加提案。
 * 输入是原 World、死因、选择回调、具体资源贡献和死亡上下文；输出保原对象的提案／延期事实。
 * await 后先核 current 与捕获 stock，再依原角色、学习、政策、来源及原生命复验，失效不付款。
 * pass／映射 miss／保护阻挡按原规则付款；消费先于保护与事实，后续失败保已付前缀。
 * 本 owner 不开死亡许可、不标死、不推进死亡波或封盘；赠枪使用独立原资源／生命周期。
 */
import {
  captureNativeGunStock,
  consumeNativeDeathGun,
  type NativeDeathGunStockQueries,
} from "./native-death-gun-resources";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import { aliveLifeVersion } from "../../../core/domain/components/alive";
import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import {
  DeathCause,
  permitsDeathShot,
  type DeathActionPolicy,
  type EntityId,
  type GameEvent,
  type Role,
  type DeathSources,
  type DeathShotSelection,
} from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { DeathHookResult, DeathHookContext } from "../hooks/hook_registry";

export interface NativeDeathShotRules extends NativeDeathGunStockQueries {
  role: Role;
  state: (
    role: RoleComponent,
  ) => { readonly canShoot: boolean; readonly deathActionPolicy?: DeathActionPolicy } | undefined;
  policy?: (state: {
    readonly canShoot: boolean;
    readonly deathActionPolicy?: DeathActionPolicy;
  }) => DeathActionPolicy;
  permits: (sources: readonly DeathCause[]) => boolean;
  shotEvent: (actorId: EntityId, targetId: EntityId) => GameEvent;
  poisonEvent?: (actorId: EntityId) => GameEvent;
}

/** 共用原单枪消费；实际目标死亡和最终判胜仍归中央结算。 */
export async function resolveNativeDeathShots(
  world: World,
  deadIds: EntityId[],
  deathSources: DeathSources,
  choose: (actorId: EntityId) => Promise<DeathShotSelection>,
  events: GameEvent[],
  rules: NativeDeathShotRules,
  context?: DeathHookContext,
): Promise<DeathHookResult> {
  const result: DeathHookResult = { extraDeaths: [], extraDeathSources: {} };
  for (const actorId of deadIds) {
    if (context?.isCurrent && !context.isCurrent()) break;
    const role = world.getComponent(actorId, COMPONENT.Role);
    const state = role ? rules.state(role) : undefined;
    if (
      !role ||
      role.role !== rules.role ||
      !state ||
      world.getComponent(actorId, COMPONENT.Alive)?.alive !== false
    )
      continue;
    // 先捕获原审计 stock 再读死因；普通／学习枪仍只写同一 canShoot，不建立影子库存。
    const stock = captureNativeGunStock(rules.role, rules, world, actorId, state);
    const consume = () => consumeNativeDeathGun(state, stock);
    const sources = deathSources[actorId] ?? [];
    if (sources.includes(DeathCause.Poison)) {
      consume();
      if (rules.poisonEvent) events.push(rules.poisonEvent(actorId));
      continue;
    }
    const policy = rules.policy?.(state);
    const deathPhase = context?.deathOriginPhase;
    const nightEffect = context?.nightEffect;
    const causeIdentity = JSON.stringify(sources);
    if (
      !state.canShoot ||
      !rules.permits(sources) ||
      (policy !== undefined && !permitsDeathShot(sources, policy, deathPhase))
    ) {
      consume();
      continue;
    }
    const actorLife = world.getComponent(actorId, COMPONENT.Alive)!;
    const actorVersion = aliveLifeVersion(actorLife);
    const camp = role.camp,
      privateState = role.privateState;
    const targets = new Map(
      world.getAliveEntityIds().map((id) => [id, captureNightLife(world, id)]),
    );
    const selected = await choose(actorId);
    if (context?.isCurrent && !context.isCurrent()) break;
    if (stock && !stock.isCurrent()) throw new Error("demon_hunter_native_hunter_stock_revoked");
    const currentRole = world.getComponent(actorId, COMPONENT.Role);
    if (
      currentRole !== role ||
      currentRole.role !== rules.role ||
      currentRole.camp !== camp ||
      currentRole.privateState !== privateState ||
      rules.state(currentRole) !== state ||
      rules.policy?.(state) !== policy ||
      context?.deathOriginPhase !== deathPhase ||
      context?.nightEffect !== nightEffect ||
      JSON.stringify(deathSources[actorId] ?? []) !== causeIdentity ||
      !rules.permits(deathSources[actorId] ?? []) ||
      (policy !== undefined &&
        !permitsDeathShot(deathSources[actorId] ?? [], policy, deathPhase)) ||
      !state.canShoot ||
      world.getComponent(actorId, COMPONENT.Alive) !== actorLife ||
      actorLife.alive ||
      aliveLifeVersion(actorLife) !== actorVersion
    )
      continue;
    if (
      selected.kind === "invalid" ||
      !world.isDeathActionOpen(actorId, "shoot", selected.deathActionId)
    )
      continue;
    if (selected.kind === "pass") {
      consume();
      continue;
    }
    if (selected.mappingCurrent && !selected.mappingCurrent()) continue;
    const targetScope = selected.targetScope ?? targets.get(selected.targetId);
    if (selected.mappedMiss) {
      if (
        !selected.mappingCurrent ||
        !targetScope ||
        targetScope.id !== selected.targetId ||
        world.getComponent(targetScope.id, COMPONENT.Alive) !== targetScope.life ||
        targetScope.life.alive ||
        aliveLifeVersion(targetScope.life) !== targetScope.version
      )
        continue;
      consume();
      events.push({
        timestamp: Date.now(),
        type: "death_shot_missed",
        payload: { actorId, reason: "no_effect" },
      });
      continue;
    }
    if (
      !targetScope ||
      targetScope.id !== selected.targetId ||
      !livingNightLife(world, targetScope)
    )
      continue;
    consume();
    if (context?.nightEffect && context.blocksNightShot(selected.targetId)) {
      events.push({
        timestamp: Date.now(),
        type: "death_shot_blocked",
        payload: { actorId, targetId: selected.targetId, reason: "night_protection" },
      });
      continue;
    }
    result.extraDeaths.push(selected.targetId);
    if (context?.nightEffect) (result.nightEffectTargets ??= []).push(selected.targetId);
    result.extraDeathSources[selected.targetId] = [DeathCause.Shot];
    const event = rules.shotEvent(actorId, selected.targetId);
    if (context?.deferShotCommit)
      (result.pendingShots ??= []).push({
        targetScope,
        event,
        isCurrent: () =>
          (context.isCurrent?.() ?? true) &&
          world.getComponent(actorId, COMPONENT.Role) === role &&
          role.role === rules.role &&
          role.camp === camp &&
          role.privateState === privateState &&
          rules.state(role) === state &&
          rules.policy?.(state) === policy &&
          context?.deathOriginPhase === deathPhase &&
          context?.nightEffect === nightEffect &&
          (policy === undefined ||
            permitsDeathShot(deathSources[actorId] ?? [], policy, deathPhase)) &&
          world.getComponent(actorId, COMPONENT.Alive) === actorLife &&
          !actorLife.alive &&
          aliveLifeVersion(actorLife) === actorVersion &&
          JSON.stringify(deathSources[actorId] ?? []) === causeIdentity &&
          world.isDeathActionOpen(actorId, "shoot", selected.deathActionId),
      });
    else events.push(event);
  }
  return result;
}
