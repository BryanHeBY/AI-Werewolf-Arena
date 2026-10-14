/**
 * 提供摄梦阶段使用的流光伯爵／蚀日侍女板子查询及原已付效果捕获绑定。
 * 输入为原 World、夜号、施法者、能力实例和目标；输出为原板子布尔查询、效果 predicate 或板外 undefined，不克隆原效果。
 * 已付效果晚查原体、来源与夜终态，不等同仍开放的行动许可；提交关闭与 abort 的不同结果仍归原 frame。
 * 本入口只加载原 night_frame，不新增 NightUnit、库存、抑制、状态装配或清理；原捕获失败及付款前缀照常传播。
 */
export { captureRadiantPaidEffect, isRadiantEclipseBoard } from "./night_frame";
