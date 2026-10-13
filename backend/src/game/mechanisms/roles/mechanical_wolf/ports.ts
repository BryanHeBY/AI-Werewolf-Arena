/**
 * 提供机械狼刀权继承的公开规则贡献。输入是在实际死亡提交之后传入的原 World、日期和事件；
 * 输出保留原学习模式下的继承写入与事实顺序。写权限与失败检查由机械狼继承所有者负责，
 * 本入口仅具名导出原函数，不建立第二份状态、不复制学习结果或重新打开已关闭窗口。
 * 状态与玩家投影查询保留原 getter 时点；潜在阶段声明不消费模式或重新安装技能。
 */

export { refreshMechanicalInheritance } from "./inheritance";

export { getMechanicalState } from "./state";

export { projectMechanicalState } from "./state";
