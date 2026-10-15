/**
 * 负责角色展示的实际创建与运行绑定。输入是角色身份、默认语言或 Catalog 安装的
 * 展示闭包；输出保持同一角色对象、当前 role 标签和晚调用的提示。绑定仅保存旧闭包的
 * 展示元数据，不复制 privateState、World 或库存，不授予行动或编码归档。
 * 未 applyRuntime 的角色只展示 component.role；只有实际初始化后才消费内建／自定义贡献。
 */
import type { Locale } from "@ai-werewolf-arena/game-contract";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role } from "@ai-werewolf-arena/game-contract";
import {
  createRoleComponent as createDomainRoleComponent,
  type RoleComponent,
} from "../../domain/components/role";

// 唯一展示绑定保存原闭包引用；角色状态仍只在 World 中的原组件。
const presentations = new WeakMap<RoleComponent, (locale?: Locale) => string>();

export function createRoleComponent(role: Role, locale: Locale = "zh-CN"): RoleComponent {
  const component = createDomainRoleComponent(role);
  bindRolePresentation(component, (displayLocale: Locale = locale) =>
    text(displayLocale, "component.role", { role: roleName(component.role, displayLocale) }),
  );
  return component;
}

/** 初始化所有者安装闭包；调用方不能据此获得角色私有状态写权限。 */
export function bindRolePresentation(
  role: RoleComponent,
  renderer: (locale?: Locale) => string,
): void {
  presentations.set(role, renderer);
}

/** 保留原可选 render 方法的存在性语义，调用时才执行已绑定的具体贡献。 */
export function rolePresentationRenderer(
  role: RoleComponent | undefined,
): ((locale?: Locale) => string) | undefined {
  return role && presentations.get(role);
}

export function renderRolePrompt(role: RoleComponent, locale?: Locale): string {
  const renderer = rolePresentationRenderer(role);
  if (!renderer) throw new Error("role_presentation_not_bound");
  return renderer(locale);
}
