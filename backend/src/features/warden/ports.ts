/**
 * 负责向具名夜伤及原生目标组合提供典狱长已付效果；输入为原World/夜次，输出同原体晚查询。
 * 没安装窗口时只作WeakMap查询，不读新配置或旧stage字段。Deal不调用查验、不授枪，保护不覆盖Shot。
 * 晚查询时点在原伤害／原生行动读取之后，端口只读；过期与原体撤权返回空贡献，失败由原调用方传播。
 */
import type { World } from "../../domain/world";
import type { NightImmunityClaim, NightDealClaim } from "../../domain/night-effects";
import { wardenEffectScopes, forcedWardenPartner, wardenOutcome } from "./authority";
export { forcedWardenPartner } from "./authority";
export { openWardenNativeDelivery } from "./native-delivery";
export function wardenNightProtections(world: World, day: number): readonly NightImmunityClaim[] {
  return wardenEffectScopes(world, day, "protect").map((scope) => ({
    target: { id: scope.id, life: scope.life, version: scope.version },
    isCurrent: () => wardenEffectScopes(world, day, "protect").includes(scope),
  }));
}
export function wardenDealAttacks(world: World, day: number): readonly NightDealClaim[] {
  return wardenEffectScopes(world, day, "deal").map((scope) => ({
    actorId: wardenOutcome(world, day)!.actorId,
    target: { id: scope.id, life: scope.life, version: scope.version },
    isCurrent: () => wardenEffectScopes(world, day, "deal").includes(scope),
  }));
}
/** 仅绑定同一次真实夜状态，不复制窗口或库存；共享组合从原claims读取点取得本族已付查询。 */
const nightStates = new WeakMap<object, { world: World; day: number }>();
export function bindWardenNightState(state: object, world: World, day: number): void {
  if (nightStates.has(state)) throw new Error("warden_night_state_already_bound");
  nightStates.set(state, { world, day });
}
export function wardenProtectionsForState(state: object): readonly NightImmunityClaim[] {
  const b = nightStates.get(state);
  return b ? wardenNightProtections(b.world, b.day) : [];
}
export function wardenDealsForState(state: object): readonly NightDealClaim[] {
  const b = nightStates.get(state);
  return b ? wardenDealAttacks(b.world, b.day) : [];
}

const nativeRuntimes = new WeakMap<object, { world: World; day: number }>();
export function bindWardenNativeRuntime(runtime: object, world: World, day: number): void {
  nativeRuntimes.set(runtime, { world, day });
}
export function forcedWardenNativeTarget(
  runtime: object,
  actorId: number,
): ReturnType<typeof forcedWardenPartner> {
  const b = nativeRuntimes.get(runtime);
  return b ? forcedWardenPartner(b.world, b.day, actorId) : null;
}
