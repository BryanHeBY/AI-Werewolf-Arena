/**
 * 提供石像鬼原状态读取、初始化及刀权继承命令的公开入口。输入是原角色和安装数据，
 * 或实际死亡提交之后的 World、事件和日期；输出保留原存储身份、复制契约和继承事件。
 * 读取与写权限由原状态、继承所有者负责，失败不回滚已写前缀。本入口不开放查验或关闭窗口的新权限。
 * 新增原刀权允许查询为只读绑定；查询结果不提交狼刀或重开已关闭回合。
 */
export { getGargoyleState, setGargoyleState } from "./state";

export { refreshGargoyleInheritance } from "./inheritance";

export { canGargoyleKnife } from "./inheritance";
