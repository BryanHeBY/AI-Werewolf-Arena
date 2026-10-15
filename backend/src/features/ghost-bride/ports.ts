/**
 * 提供鬼魂新娘具体夜间生命周期、死亡波发布、玩家知识及请求预检的公开入口。
 * 输入保留原 World、捕获／关闭引用与所属事件；输出为原单元、已告知数据和请求查询结果。
 * 死亡关系在原初始／追加波处扩张并发布，开启在原夜间阶段，晚移交先于 pipeline 清理；close／abort 保持经理与 pipeline 顺序。
 * 单元独自拥有清理移交，准备与已付款关系各归原权威；原当前性和读写权限检查不变。
 * 具名出口不增加回合、库存或作用域权限，不把玩家关系知识当成提交许可。
 */
export { WeddingNightUnit, weddingNightTerminal } from "./night-lifecycle";

/** 原引擎和狼工具组合查询保持同一权威函数绑定与参数；成员知识不代替提交时的回合复验。 */
export {
  weddingSetup,
  ghostBrideReady,
  hasActiveGhostBride,
  hasGhostBrideNightCommit,
  weddingAssignment,
  weddingKnifeCurrent,
  weddingMember,
  canSubmitWeddingTool,
} from "./authority";

export { weddingBrideState } from "./authority";

export { ghostBrideRequestScope } from "./authority";

/** 原地关系扩张及逐边事实归机制；日期／阶段／事件仍按原时点晚读，不提交实际死亡。 */
export {
  WeddingDeathWavePublication,
  bindWeddingDeathWavePublication,
} from "./death-wave-publication";
export type { WeddingDeathWavePorts } from "./death-wave-publication";

/** 开局组合使用同一准备类绑定；具体窗口仍拥有选择校验、提交与失败关闭。 */
export { GhostBrideSetupWindow } from "./setup";
