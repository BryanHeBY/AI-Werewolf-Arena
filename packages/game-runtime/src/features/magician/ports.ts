/**
 * 提供魔术师具体共享清理所有者、原生目标可读性与状态投影的公开入口。
 * 输入为原配置的移交值或 World／日期终结读取；输出为单元、只读所有权视图和原查询绑定。
 * 共享视图不授移交命令、World、目标映射或库存写权；阶段时点与 frame 拒绝保持原样。
 * 原生目标查询保留原当前生命绑定；状态 live 读保原引用，投影为可写脱离知识，不授库存或交换提交权。
 * 本出口不渲染文字、记录事实或创建另一生命周期所有者。
 * 清理的关闭与失败前缀由清理单元维护，出口不增加关闭重试或去重；重复调用和错误保持原 frame 政策。
 */
export { MagicianNightUnit, magicianNightTerminal } from "./night-lifecycle";
export type { MagicianNightRuntime, MagicianNightCleanupOwnership } from "./night-lifecycle";
export { assertMagicianRosterCurrent, isMagicianBoard } from "./night-frame";
export { resolveMagicianNightTarget } from "./night-frame";
export type { MagicianResolvedTarget } from "./night-frame";

export { getMagicianState, projectMagicianState } from "./state-slot";
