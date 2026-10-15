/**
 * 负责实际装配角色资料、运行与展示。输入是原自定义 flat profile 或明确三贡献集合，默认使用
 * 原 55 角色的登记顺序；输出为唯一默认 Catalog 或独立 Catalog。捕获函数在此实际注入，
 * 不在 profile 声明时建立反向展示依赖。初始化／显示仍由 Catalog 在原时点执行，不复制状态。
 */
import { ownRoleCallback } from "./owned-bindings";
import { RoleCatalog } from "./catalog";
import type { RoleContributions, RoleProfile, NativeRoleContributions } from "./contracts";

export function createRoleCatalog(
  input?: readonly RoleProfile[] | { contributions: readonly RoleContributions[] },
): RoleCatalog {
  // 登记也在实际装配时加载，避免单独导入某个角色时经运行查询绕回尚未初始化的登记表。
  const { BUILTIN_ROLE_CONTRIBUTIONS } =
    require("./builtin-contributions") as typeof import("./builtin-contributions");
  const resolved = input ?? { contributions: BUILTIN_ROLE_CONTRIBUTIONS };
  const builtinMetadata = BUILTIN_ROLE_CONTRIBUTIONS.map((entry) => entry.metadata);
  if (Array.isArray(resolved)) return new RoleCatalog(resolved, builtinMetadata);
  // 仅在实际装配原生运行时加载完整捕获；声明及纯自定义接入不提前初始化展示依赖。
  const { captureNativeRolePresentation } =
    require("../../agents/observation/native-role-presentation-capture") as typeof import("../../agents/observation/native-role-presentation-capture");
  return new RoleCatalog(
    {
      contributions: (resolved as { contributions: readonly RoleContributions[] }).contributions,
      renderNative: ownRoleCallback("renderNative", {
        renderNative: captureNativeRolePresentation,
      }),
    },
    builtinMetadata,
  );
}

let defaultCatalog: RoleCatalog | null = null;

/** 默认实例只缓存实际装配的 Catalog，不保存另一份角色状态或展示结果。 */
export function getDefaultRoleCatalog(): RoleCatalog {
  if (!defaultCatalog) defaultCatalog = createRoleCatalog();
  return defaultCatalog;
}

/** 按原顺序公开组合声明的副本；保留每份贡献引用，不向调用者开放登记数组写权。 */
export function getDefaultRoleContributions(): readonly NativeRoleContributions[] {
  const { BUILTIN_ROLE_CONTRIBUTIONS } =
    require("./builtin-contributions") as typeof import("./builtin-contributions");
  return Array.from(BUILTIN_ROLE_CONTRIBUTIONS);
}
