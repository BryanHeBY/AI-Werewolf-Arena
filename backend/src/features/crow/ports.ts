/**
 * 负责向观察捕获与放逐计票组合导出乌鸦具名端口，输入仍是调用点的原角色或World。
 * 观察只读脱离数据；加票仅在真实放逐轮次原计票之后调用，不能借本出口创建夜窗或提交选择。
 * 状态、已付原生命与失败/关闭政策保留在本族唯一owner；此处不缓存、复制或重排原调用时点。
 */
export { projectCrowState } from "./state";
export { applyCrowBonus } from "./authority";
