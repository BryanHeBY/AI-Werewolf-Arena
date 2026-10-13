/**
 * 提供隐狼原状态读取与刀权继承命令的公开入口。输入是原角色组件，或实际死亡提交之后的 World、事件和日期；
 * 输出保留同一只读状态引用及原继承写入和觉醒事件。查询与写权限仍由状态、继承所有者负责，
 * 失败保留原已写前缀，关闭窗口不获得额外授权。本入口仅具名导出本角色函数，不复制或存储状态。
 */
export { getHiddenWolfState } from "./state";

export { refreshHiddenWolfInheritance } from "./inheritance";
