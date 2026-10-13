/**
 * 负责 平民 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：平民角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";

/** 平民角色配置。 */
export const VILLAGER_ROLE_PROFILE: RoleProfile = {
  role: Role.Villager,
  camp: Camp.Good,
  label: roleName("villager"),
  skillBrief: text("zh-CN", "role.villager.brief"),
  goodSide: "villager",
  ...nativeRolePresentation("villager"),
};
