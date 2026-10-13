/**
 * 负责在校验和提交时点查询原生自爆资格。输入为当前角色及 Catalog 的运行贡献；输出为原布尔资格，不写状态、开启自爆窗口或授予请求权限。
 */
import type { RoleComponent } from "../../../core/domain/components/role";
import type { RoleCatalog } from "./catalog";

export function canRoleSelfDestruct(role: RoleComponent, catalog: RoleCatalog): boolean {
  const capability = catalog.runtime(role.role)?.canSelfDestruct;
  return typeof capability === "function" ? capability(role) : capability === true;
}
