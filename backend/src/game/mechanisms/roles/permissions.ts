/**
 * 负责按角色运行贡献生成领域工具许可注册表。输入为明确 Catalog，输出为角色与可用工具的原有序登记；公共工具与原贡献去重，不维护第二份角色资料或提示视图，也不授权具体行动租约。
 */
import { RoleRegistry } from "../../../core/domain/registries/role_registry";
import { COMMON_TOOL_SPECS } from "../common/tool_specs";
import { type RoleCatalog } from "./catalog";
import { getDefaultRoleCatalog } from "./role-catalog-assembly";

export function createDefaultRoleRegistry(
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): RoleRegistry {
  const registry = new RoleRegistry();
  const commonTools = COMMON_TOOL_SPECS.map((spec) => spec.name);
  for (const { metadata, runtime: profile } of catalog.allRuntime()) {
    // 在原 register 参数求值点读取角色字段，保留自定义资料 getter 和可变角色标识的原轨迹。
    registry.registerAllowedTools(metadata.role, [
      ...new Set([...commonTools, ...(profile.toolSpecs ?? []).map((spec) => spec.name)]),
    ]);
  }
  return registry;
}
