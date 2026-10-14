/**
 * 记录身份安装失败后已退休的 Role 运行授权；输入为实际组件对象，输出为永久退休标记与拒绝查询。
 * 只有具体安装 writer 在声明的核心失败边界标记，字段恢复或跨 World 复用同对象都不能清除；新对象仍须经过各自许可校验。
 * 私有集合不保存 Camp、World、库存或快照，不改组件属性；false 仅表示未被该失败政策退休，不代表可以执行行动。
 * 纯数据、已付效果的原体复验、目标身份、观察、归档和死亡清理各保原职责；正常组件变化不自动退休。
 */
import type { RoleComponent } from "./components/role";

// 用对象身份记录不可恢复的执行终态；不写公开字段，冻结的组件也能保留最初安装错误。
const retiredExecutions = new WeakSet<RoleComponent>();

/** 受信任的身份安装 writer 专用；重复退休幂等，不回滚已经完成的组件、库存或事实前缀。 */
export function retireRoleExecution(role: RoleComponent): void {
  retiredExecutions.add(role);
}

/** 仅提供拒绝条件，调用方仍须按原顺序检查生命、来源、资源、阶段及实际提交资格。 */
export function isRoleExecutionRetired(role: RoleComponent): boolean {
  return retiredExecutions.has(role);
}
