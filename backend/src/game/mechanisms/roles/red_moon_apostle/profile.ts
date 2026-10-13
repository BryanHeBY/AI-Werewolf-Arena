/**
 * 负责 赤月使徒 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { redMoonVotedOutHook } from "./voted_out_hook";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, WinCondition } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { RED_MOON_POLICY, freshRedMoonState, getRedMoonState } from "./state";
const parameters = z.strictObject({
  policy: z.literal(RED_MOON_POLICY).default(RED_MOON_POLICY),
  lastWolfBlastPolicy: z.enum(["ends_game", "forbidden"]).default("ends_game"),
});
/** 有限运行资料；完整发布验收由红月使徒规则契约跟踪。 */
export const RED_MOON_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.RedMoonApostle,
  maxCount: 1,
  votedOutHook: redMoonVotedOutHook,
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.Wolf,
    Role.RedMoonApostle,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.DemonHunter,
    Role.Idiot,
  ],
  label: roleName("red_moon_apostle"),
  skillBrief: text("zh-CN", "role.red_moon_apostle.brief"),
  init: (role, ctx) => {
    role.privateState.redMoon = freshRedMoonState(
      parameters.parse(ctx.boardConfig?.redMoon ?? {}).lastWolfBlastPolicy,
    );
  },
  ...nativeRolePresentation("red_moon_apostle"),
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, redMoon: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.redMoon ?? {}),
  },
};
