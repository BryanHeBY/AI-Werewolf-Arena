/**
 * 负责内建展示贡献的具体声明与现有 profile API 适配。输入是运行角色标识；输出为只含
 * id 的冻结展示元数据和原 profile.renderPrompt 调用入口。代理、浅拷贝及原型继承仍通过
 * 原方法字段读取，实际显示才按该 id 调用完整捕获与纯片段格式化，创建时不读 World。
 * 此兼容入口仅保存静态声明，不持角色、库存或 World，不授予行动权限。领域 RoleComponent
 * 不恢复 renderPrompt；profile 的这个旧 API 待三贡献装配与 C44 完整消费者切换后退出。
 */
import type { NativeRolePresentationId, Locale } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { World } from "../../../core/domain/world";
import { captureNativeRolePresentation } from "../../observation/native-role-presentation-capture";

export interface NativeRolePresentationContribution {
  readonly id: NativeRolePresentationId;
}

export function nativeRolePresentation(id: NativeRolePresentationId): {
  nativePresentation: NativeRolePresentationContribution;
  renderPrompt: (role: RoleComponent, locale?: Locale, world?: World) => string;
} {
  const contribution = Object.freeze({ id });
  return {
    nativePresentation: contribution,
    // 原方法查找与 World 参数求值发生在调用方；此处不重取调用方字段或提前收齐状态。
    renderPrompt: (role, locale = "zh-CN", world) =>
      captureNativeRolePresentation(contribution.id, role, locale, world),
  };
}
