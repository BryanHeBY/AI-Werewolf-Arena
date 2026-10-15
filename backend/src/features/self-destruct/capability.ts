/**
 * 负责在校验和提交时点查询原生自爆资格。输入为当前角色、晚阵营 source 及 Catalog 的运行贡献；输出为原能力与未退休条件共同允许的资格，不写状态、开启自爆窗口或授予请求权限。正常阵营变化不自动退休，恢复失败对象字段也不能恢复执行。
 */
import { invokeRoleCallback } from "../../rulesets/roles/owned-bindings";
import type { RoleComponent } from "../../domain/components/role";
import type { CurrentCampSource } from "../../domain/components/camp";
import type { RoleCatalog } from "../../rulesets/roles/catalog";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";

export function canRoleSelfDestruct(
  role: RoleComponent,
  catalog: RoleCatalog,
  currentCamp: CurrentCampSource,
): boolean {
  const capability = catalog.runtime(role.role)?.canSelfDestruct;
  // 保原 callback 裸调用及其异常；能力读取成功之后才叠加不可恢复的演员退休拒绝。
  const allowed =
    typeof capability === "function"
      ? invokeRoleCallback("canSelfDestruct", capability, undefined, role, currentCamp)
      : capability === true;
  if (allowed && isRoleExecutionRetired(role)) return false;
  return allowed;
}
