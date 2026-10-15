/**
 * 负责死亡枪资格的完整捕获与晚复验：原赠枪、原生库存／政策／死因身份及猎魔人原体查询。
 * 输入为原 actor／ability／来源、来源阶段、惰性 World／日期和原当前性回调；
 * 输出为缺失赠枪的 null，或原政策及 permissionCurrent／eligible 函数引用。
 * 本模块不打开行动许可、消费弹药、选择目标、标死或发布事件；数据与回调不是 JSON 授权。
 * 原生 Hunter 身份在赠枪路径也保留；Demon→枪→原生政策的原短路保持。
 * 新捕获在原 state／policy／cause 读取后拒退休 Role；行动 eligible 晚拒墓碑，再读 canShoot。
 * permissionCurrent 保原请求许可正文；赠枪仍依赖 active 执行资格，可能被其守卫拒绝。
 * 真正已消费提案分别保赠枪 capture.isCurrent 与原生 pending 的原当前性，不合并成行动资格。
 */
import { Role, type EntityId, type DeathSources, type Phase, type DeathActionPolicy } from "@ai-werewolf-arena/game-contract";
import { isRoleExecutionRetired } from "../../../domain/role-execution-authority";
import { COMPONENT } from "../../../domain/components/names";
import type { World } from "../../../domain/world";
import { permitsDeathShot } from "../../../domain/deaths";
import { activeDeathGun, captureDeathGun } from "./death-gun-lifecycle";
import { getHunterState } from "./hunter/ports";
import { getWolfKingState } from "./wolf_king/ports";
import type { demonHunterNativeGunCurrent } from "./demon_hunter/ports";

/** 只读运行查询；生产 getter 晚读原字段及原命令，不冻结 World 或复制生命／枪权。 */
interface DeathShotEligibilityRuntime {
  readonly world: World;
  readonly day: number;
  readonly demonHunterNativeGunCurrent: typeof demonHunterNativeGunCurrent;
}

/** 只捕获原比较基准与函数，后续请求／await 前后仍在原调用点复验；不是新的许可或库存。 */
export interface DeathShotEligibility {
  readonly nativePolicy: DeathActionPolicy;
  readonly permissionCurrent: () => boolean;
  readonly eligible: () => boolean;
}

export function captureDeathShotEligibility(
  runtime: DeathShotEligibilityRuntime,
  actorId: EntityId,
  abilityId: string | undefined,
  sources: DeathSources,
  deathOriginPhase: Phase,
  isCurrent: () => boolean,
): DeathShotEligibility | null {
  const gun =
    abilityId === undefined
      ? undefined
      : activeDeathGun(runtime.world, actorId, abilityId, runtime.day, true);
  if (abilityId !== undefined && !gun) return null;
  const role = runtime.world.getComponent(actorId, COMPONENT.Role);
  const nativeState =
    abilityId === undefined && role
      ? role.role === Role.Hunter
        ? getHunterState(role)
        : role.role === Role.WolfKing
          ? getWolfKingState(role)
          : undefined
      : undefined;
  const nativeHunter = role?.role === Role.Hunter;
  const nativePolicy = nativeState?.deathActionPolicy ?? "awa_qualified_sources_v1";
  const causeIdentity = JSON.stringify(sources[actorId] ?? []);
  // 先保原捕获前缀；没有赠枪／nativeState 的原分支也不能为已退休对象建立新行动资格。
  if (role && isRoleExecutionRetired(role)) return null;
  const nativeCurrent = () =>
    !nativeState ||
    (runtime.world.getComponent(actorId, COMPONENT.Role) === role &&
      (role?.role === Role.Hunter
        ? getHunterState(role)
        : role?.role === Role.WolfKing
          ? getWolfKingState(role)
          : undefined) === nativeState &&
      (nativeState.deathActionPolicy ?? "awa_qualified_sources_v1") === nativePolicy &&
      JSON.stringify(sources[actorId] ?? []) === causeIdentity &&
      permitsDeathShot(sources[actorId] ?? [], nativePolicy, deathOriginPhase));
  const gunCurrent = gun
    ? captureDeathGun(runtime.world, actorId, gun, runtime.day, isCurrent).isEligible
    : isCurrent;
  // 仅在原 nativeHunter 分支取得同一查询并裸调用；赠枪的 Hunter 身份也不能跳过此复验。
  const demonNativeCurrent = () => {
    const query = runtime.demonHunterNativeGunCurrent;
    return query(runtime.world, actorId);
  };
  const permissionCurrent = () =>
    (!nativeHunter || demonNativeCurrent()) &&
    gunCurrent() &&
    nativeCurrent();
  const eligible = () =>
    permissionCurrent() &&
    (!role || !isRoleExecutionRetired(role)) &&
    (!nativeState || nativeState.canShoot) &&
    // 保原 canShoot getter 的读取与异常；其回调若退休原 Role，不能返回新的行动资格。
    (!role || !isRoleExecutionRetired(role));
  return { nativePolicy, permissionCurrent, eligible };
}
