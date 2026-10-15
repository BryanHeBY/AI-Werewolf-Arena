/**
 * 提供觉醒隐狼刀权继承的公开规则贡献。输入是在实际死亡提交之后传入的原 World、日期和事件；
 * 输出保留原激活资源、能力引用和继承事件顺序。写权限与失败检查由觉醒隐狼继承所有者负责，
 * 本入口仅具名导出原函数，不刷新已付费的资源或重新打开已关闭窗口。
 * 状态与玩家投影查询沿原 getter 时点执行；声明的潜在阶段仍是同一绑定，不提前激活能力。
 */

export { refreshAwakenedInheritance } from "./inheritance";

export { getAwakenedState } from "./state";

export { projectAwakenedState } from "./state";
