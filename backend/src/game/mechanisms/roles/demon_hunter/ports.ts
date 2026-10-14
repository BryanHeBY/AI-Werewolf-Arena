/**
 * 提供猎魔人具体夜间生命周期、玩家投影及请求预检的公开入口；输入保留原 World、开启与终结引用。
 * 输出为实际夜间单元、原查询结果与原工具读取绑定。开启仍在原阶段，晚移交先于 pipeline 清理，
 * close／abort 保持经理与 pipeline 的原顺序；请求当前性、资源读写权限仍由具体权威所有者验证。
 * 单元拥有获取与移交，权威拥有规则；公开入口不新增作用域、包装状态、库存或编码政策。
 * 原生控制器 loader 仅在实际调用时返回原动态 import Promise，公开它们不提前初始化控制器。
 * 猎魔来源折叠先于夜仆收尾，事实发布在最终来源检查之后；公开窄查询不授予库存或死亡写权。
 */
export { DemonNightUnit, demonNightTerminal } from "./night-lifecycle";

/** 原引擎查询保持同一权威函数绑定与参数。 */
export {
  isRedMoonBoard,
  demonHunterActorId,
  demonHunterNativeGunCurrent,
  assertDemonNightReadable,
  originalDemonNightLives,
  demonOriginalWolfSourceCurrent,
  demonOriginalWolfTargetCurrent,
  demonRedMoonExpiry,
  commitDemonRedMoonTransition,
  committedDemonFaultBoundary,
  assertDemonOriginalRoster,
  hasDemonNightStarted,
  demonWitchRequiredThisNight,
} from "./authority";

/** 原生控制器保持原懒加载 import Promise，仅在实际使用时初始化。 */
export function loadDemonNativeNightController() {
  return import("./native_night_controller");
}

export function loadDemonNativePotionController() {
  return import("./native_potion_controller");
}

export { projectDemonHunter } from "./authority";

export { demonWitchRequestTargetCurrent } from "./native_potion_requests";

export { demonWitchRequestCurrent } from "./native_potion_requests";

export { readDemonNativeNightTool } from "./native_potion_requests";

export { readDemonPotionTool } from "./native_potion_requests";

export { demonHunterRequestScope } from "./authority";

export { canSubmitDemonHunt } from "./authority";

export { readDemonHuntTool } from "./state";

export {
  appendDemonNightDamageSources,
  publishDemonNightDamageSources,
  type DemonKnifeProtection,
  type DemonNightDamageQueries,
  type DemonNightDamagePublicationRuntime,
} from "./night-damage-contribution";
