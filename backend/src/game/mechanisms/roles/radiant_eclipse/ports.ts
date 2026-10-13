/**
 * 明辉夜 unit 与原 frame 查询的公开边界，保留 roster、封存效果和重复 close 的权威。
 * 已取得的 abort 仍在正常 close 后读取参数，终止幂等和失败前缀由原 frame 拥有；
 * 不授予阶段、演员选择或死亡提交权限。Eclipse 玩家投影返回独立数据。
 * 庇护状态契约额外公开原 strict reader 与初始化／明确 payload 命令；prepare 只做旧 JSON
 * 复制，效果／次数与首死过期权仍在原 owner，不能将数据合法性当作新 lease。
 */
export { RadiantNightUnit } from "./night-lifecycle";
export type { RadiantNightRuntime } from "./night-lifecycle";
export {
  isRadiantEclipseBoard,
  assertRadiantRosterCurrent,
  sealRadiantNightEffects,
} from "./night_frame";

export { projectEclipseState } from "./state";

export { SHELTER_STATE_SLOT } from "./shelter-state-slot";
export { createShelterState, readShelterState, selectShelter } from "./shelter-state";
