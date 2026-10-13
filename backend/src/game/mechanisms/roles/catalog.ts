/**
 * 管理角色资料、运行和展示的独立查询与有序注册。内建输入已经由实际组合根分开登记，
 * 自定义 flat 输入保留原对象，输出为原贡献引用与晚执行的展示绑定；查询不复制字段、提前求值 getter 或改变回调 receiver。
 * 初始化仍先于默认语言读取，展示才按当前 role 查具体贡献；Catalog 不导入捕获程序。
 * 资料、运行贡献和原文不能相互授予权限，原重复／缺失角色错误前缀保持不变。
 */
import type { Locale } from "@ai-werewolf-arena/game-catalog";
import { Camp, type Role, type NativeRolePresentationId } from "@ai-werewolf-arena/game-contract";
import { roleName, text, type MessageKey } from "@ai-werewolf-arena/game-text";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { World } from "../../../core/domain/world";
import { bindRolePresentation } from "../../observation/role-presentation";
import type {
  RoleContributions,
  RoleInitContext,
  RoleInitializationComponent,
  RoleMetadata,
  RoleProfile,
  RoleRuntimeContribution,
} from "./contracts";

export type NativeRoleRenderer = (
  id: NativeRolePresentationId,
  role: RoleComponent,
  locale: Locale,
  world?: World,
) => string;

/** 内建运行必须显式提供展示装配；自定义数组保持既有 flat 用户输入协议。 */
export type RoleCatalogInput =
  | readonly RoleProfile[]
  | { contributions: readonly RoleContributions[]; renderNative: NativeRoleRenderer };

type Entry =
  | { kind: "custom-profile"; profile: RoleProfile }
  | { kind: "contributions"; contributions: RoleContributions; renderNative: NativeRoleRenderer };

export class RoleCatalog {
  private readonly byRole = new Map<Role, Entry>();

  constructor(
    input: RoleCatalogInput,
    private readonly builtinMetadata: readonly RoleMetadata[],
  ) {
    // 输入形态由调用者明确选择；不为识别新协议而探测用户 profile 的新字段或 descriptor。
    if (Array.isArray(input)) {
      for (const profile of input) {
        if (this.byRole.has(profile.role))
          throw new Error(`role_profile_duplicate: ${profile.role}`);
        this.byRole.set(profile.role, { kind: "custom-profile", profile });
      }
    } else {
      const native = input as Exclude<RoleCatalogInput, readonly RoleProfile[]>;
      for (const contributions of native.contributions) {
        if (this.byRole.has(contributions.metadata.role))
          throw new Error(`role_profile_duplicate: ${contributions.metadata.role}`);
        this.byRole.set(contributions.metadata.role, {
          kind: "contributions",
          contributions,
          renderNative: native.renderNative,
        });
      }
    }
  }

  metadata(role: Role): RoleMetadata | undefined {
    const entry = this.byRole.get(role);
    return entry?.kind === "custom-profile" ? entry.profile : entry?.contributions.metadata;
  }

  runtime(role: Role): RoleRuntimeContribution | undefined {
    const entry = this.byRole.get(role);
    return entry?.kind === "custom-profile" ? entry.profile : entry?.contributions.runtime;
  }

  allMetadata(): RoleMetadata[] {
    return Array.from(this.byRole.values(), (entry) =>
      entry.kind === "custom-profile" ? entry.profile : entry.contributions.metadata,
    );
  }

  allRuntime(): { role: Role; metadata: RoleMetadata; runtime: RoleRuntimeContribution }[] {
    return Array.from(this.byRole, ([role, entry]) => ({
      role,
      metadata: entry.kind === "custom-profile" ? entry.profile : entry.contributions.metadata,
      runtime: entry.kind === "custom-profile" ? entry.profile : entry.contributions.runtime,
    }));
  }

  requireMetadata(role: Role): RoleMetadata {
    const entry = this.requireEntry(role);
    return entry.kind === "custom-profile" ? entry.profile : entry.contributions.metadata;
  }

  requireRuntime(role: Role): RoleRuntimeContribution {
    const entry = this.requireEntry(role);
    return entry.kind === "custom-profile" ? entry.profile : entry.contributions.runtime;
  }

  participation(role: RoleComponent): {
    canVote: boolean;
    canBeExiled: boolean;
    canBeSheriff: boolean;
  } {
    const runtime = this.runtime(role.role);
    if (!runtime) return { canVote: false, canBeExiled: false, canBeSheriff: false };
    return typeof runtime.participation === "function"
      ? { ...runtime.participation(role) }
      : { ...(runtime.participation ?? { canVote: true, canBeExiled: true, canBeSheriff: true }) };
  }

  getCamp(role: Role): Camp {
    return this.requireMetadata(role).camp ?? Camp.Good;
  }

  label(role: Role, locale: Locale = "zh-CN"): string {
    const metadata = this.metadata(role);
    const builtIn = this.builtinMetadata.find((entry) => entry.role === role);
    // 显式用户原文继续绕过内建翻译；仅等于原内建文字时采用原翻译策略。
    if (metadata && (!builtIn || metadata.label !== builtIn.label)) return metadata.label;
    return roleName(role, locale);
  }

  skillBrief(role: Role, locale: Locale = "zh-CN"): string {
    const metadata = this.metadata(role);
    if (!metadata) return role;
    const builtIn = this.builtinMetadata.find((entry) => entry.role === role);
    if (!builtIn || metadata.skillBrief !== builtIn.skillBrief) return metadata.skillBrief;
    return text(locale, `role.${role}.brief` as MessageKey);
  }

  applyRuntime(roleComp: RoleComponent, ctx: RoleInitContext = {}): void {
    const entry = this.requireEntry(roleComp.role);
    const runtime = entry.kind === "custom-profile" ? entry.profile : entry.contributions.runtime;
    runtime.init?.(roleComp as RoleInitializationComponent, ctx);
    const defaultLocale = ctx.locale ?? "zh-CN";
    bindRolePresentation(roleComp, (locale = defaultLocale) => {
      const active = this.requireEntry(roleComp.role);
      if (active.kind === "custom-profile") {
        // 保留原两次方法 getter、profile receiver 及随后 ctx.world 求值的完整失败前缀。
        return active.profile.renderPrompt
          ? active.profile.renderPrompt(roleComp, locale, ctx.world)
          : text(locale, "role.generic.state", {
              role: this.label(active.profile.role, locale),
            });
      }
      const presentation = active.contributions.presentation;
      if (presentation.kind === "native")
        return active.renderNative(presentation.id, roleComp, locale, ctx.world);
      return presentation.renderPrompt
        ? presentation.renderPrompt(roleComp, locale, ctx.world)
        : text(locale, "role.generic.state", {
            role: this.label(active.contributions.metadata.role, locale),
          });
    });
  }

  private requireEntry(role: Role): Entry {
    const entry = this.byRole.get(role);
    if (!entry) throw new Error(`role_profile_not_registered: ${role}`);
    return entry;
  }
}
