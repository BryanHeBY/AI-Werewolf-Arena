/**
 * 负责向玩家观察捕获导出禁言长老的只读知识投影；输入为原角色，输出严格脱离状态或null。
 * 实际读取时点由观察调用方持有；本出口不写库存、不创建夜窗/表达许可，失败政策留在本族state。
 */
export { projectSilenceElderState } from "./state";
