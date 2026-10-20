/**
 * 负责将本夜唯一已付解药提案绑定到真实夜状态对象。输入为原状态与同一claim，输出该提案的只读视图。
 * 弱绑定只路由同一效果，不持瓶数、目标镜像或第二份世界状态；未配置板不读取新字段。
 */
import type { NightHealClaim } from "../../domain/night-effects";
const claims = new WeakMap<object, readonly NightHealClaim[]>();
export function bindAwakenedWitchHeal(state: object, claim: NightHealClaim): void {
  if (claims.has(state)) throw new Error("awakened_witch_heal_already_bound");
  claims.set(state, Object.freeze([claim]));
}
export function awakenedWitchHealForState(state: object): readonly NightHealClaim[] | undefined {
  return claims.get(state);
}
