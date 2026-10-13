/**
 * 负责 咒狐 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role, WinCondition } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
export const CURSED_FOX_GOAL = "netease_cursed_fox_last_faction_v1";
/** 规则来源与工程补全见 docs/expansion/rules/netease-cursed-fox-v1.md。 */
export const CURSED_FOX_ROLE_PROFILE: RoleProfile = {
  role: Role.CursedFox,
  camp: Camp.ThirdParty,
  maxCount: 1,
  label: roleName("cursed_fox"),
  skillBrief: text("zh-CN", "role.cursed_fox.brief"),
  initialVictoryAffiliations: [{ kind: "individual", goalId: CURSED_FOX_GOAL }],
  inspectionLabels: { camp: Camp.Good },
  supportedWinConditions: [WinCondition.SlaughterCity],
  supportedBoardRoles: [
    Role.CursedFox,
    Role.Wolf,
    Role.WolfKing,
    Role.WhiteWolfKing,
    Role.HiddenWolf,
    Role.Seer,
    Role.Witch,
    Role.Guard,
    Role.Hunter,
    Role.Idiot,
    Role.Villager,
    Role.Knight,
    Role.Dreamer,
    Role.MiracleMerchant,
    Role.MirrorGirl,
  ],
  ...nativeRolePresentation("cursed_fox"),
  configuration: {
    schema: z.strictObject({}),
    defaults: {},
    apply: (config) => config,
    serialize: () => ({}),
  },
};
