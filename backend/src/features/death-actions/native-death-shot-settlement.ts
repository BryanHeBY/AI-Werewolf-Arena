/**
 * 负责四族原生／学习枪的完整死亡结算：死因资格、选择等待、原体复验、付款与追加提案。
 * 输入是原 World、死因、选择回调、具体资源贡献和死亡上下文；输出保原对象的提案／延期事实。
 * await 后先核 current 与捕获 stock，再依原角色、学习、政策、来源及原生命复验，失效不付款。
 * pass／映射 miss／保护阻挡按原规则付款；消费先于保护与事实，后续失败保已付前缀。
 * 已退休 Role 只在未消费行动入口与等待后拒绝；原 stock 异常与完整原体检查先行。
 * state 只接晚取阵营 source，普通 Hunter／WolfKing 可忽略；原值比较不升级组件引用撤权。
 * 已消费延期提案保原 isCurrent，不因行动墓碑撤回已付前缀；本 owner 不开许可、标死或封盘。
 */
import type { CurrentCampSource } from "../../domain/components/camp";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import {
  captureNativeGunStock,
  consumeNativeDeathGun,
  type NativeDeathGunStockQueries,
} from "./native-death-gun-resources";
import { captureNightLife, livingNightLife } from "../../domain/night-effects";
import { aliveLifeVersion } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import {
  DeathCause,
  permitsDeathShot,
  type DeathActionPolicy,
  type EntityId,
  type GameEvent,
  type Role,
  type DeathSources,
  type DeathShotSelection,
} from "../../domain/model";
import type { World } from "../../domain/world";
import type { DeathHookResult, DeathHookContext } from "../../engine/hooks/registry";

export interface NativeDeathShotRules extends NativeDeathGunStockQueries {
  role: Role;
  state: (
    role: RoleComponent,
    currentCamp: CurrentCampSource,
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
    const state = role ? rules.state(role, () => world.getComponent(actorId, COMPONENT.Camp)) : undefined;
    if (
      !role ||
      role.role !== rules.role ||
      !state ||
      world.getComponent(actorId, COMPONENT.Alive)?.alive !== false
    )
      continue;
    // 原角色／状态／死亡检查已通过，退休只拒未消费行动；不把纯 state 查询变成权限。
    if (isRoleExecutionRetired(role)) continue;
    // 先捕获原审计 stock 再读死因；普通／学习枪仍只写同一 canShoot，不建立影子库存。
    const stock = captureNativeGunStock(rules.role, rules, world, actorId, state);
    const consume = () => consumeNativeDeathGun(state, stock);
    const sources = deathSources[actorId] ?? [];
    if (sources.includes(DeathCause.Poison)) {
      if (isRoleExecutionRetired(role)) continue;
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
      if (isRoleExecutionRetired(role)) continue;
      consume();
      continue;
    }
    const actorLife = world.getComponent(actorId, COMPONENT.Alive)!;
    const actorVersion = aliveLifeVersion(actorLife);
    const camp = world.getComponent(actorId, COMPONENT.Camp)?.camp,
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
      world.getComponent(actorId, COMPONENT.Camp)?.camp !== camp ||
      currentRole.privateState !== privateState ||
      rules.state(currentRole, () => world.getComponent(actorId, COMPONENT.Camp)) !== state ||
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
    // 保原 context→stock 撤权错误→完整原体复验的优先级，然后才拒退休演员，仍未消费。
    if (isRoleExecutionRetired(role)) continue;
    if (
      selected.kind === "invalid" ||
      !world.isDeathActionOpen(actorId, "shoot", selected.deathActionId)
    )
      continue;
    if (selected.kind === "pass") {
      if (isRoleExecutionRetired(role)) continue;
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
      if (isRoleExecutionRetired(role)) continue;
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
    // 原映射／目标回调可在复验中同步退休演员；全部原检查完成后、消费前再核同一 Role。
    if (isRoleExecutionRetired(role)) continue;
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
          world.getComponent(actorId, COMPONENT.Camp)?.camp === camp &&
          role.privateState === privateState &&
          rules.state(role, () => world.getComponent(actorId, COMPONENT.Camp)) === state &&
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
