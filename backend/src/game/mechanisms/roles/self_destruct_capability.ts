/**
 * 负责在校验和提交时点查询原生自爆资格。输入为当前角色及 Catalog 的运行贡献；输出为原能力与未退休条件共同允许的资格，不写状态、开启自爆窗口或授予请求权限。正常阵营变化不自动退休，恢复失败对象字段也不能恢复执行。
 */
import type { RoleComponent } from "../../../core/domain/components/role";
import type { RoleCatalog } from "./catalog";
import { isRoleExecutionRetired } from "../../../core/domain/role-execution-authority";

export function canRoleSelfDestruct(role: RoleComponent, catalog: RoleCatalog): boolean {
  const capability = catalog.runtime(role.role)?.canSelfDestruct;
  // 保原 callback 裸调用及其异常；能力读取成功之后才叠加不可恢复的演员退休拒绝。
  const allowed = typeof capability === "function" ? capability(role) : capability === true;
  if (allowed && isRoleExecutionRetired(role)) return false;
  return allowed;
}
