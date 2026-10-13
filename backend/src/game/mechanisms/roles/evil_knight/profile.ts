/**
 * 负责 恶夜骑士 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, WinCondition } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { EVIL_KNIGHT_POLICY, freshEvilKnightState, getEvilKnightState } from "./state";
import { EVIL_KNIGHT_FRAME_STAGE } from "./night_frame";
const parameters = z.strictObject({
  policy: z.literal(EVIL_KNIGHT_POLICY).default(EVIL_KNIGHT_POLICY),
  shotPolicy: z.enum(["night_shot_immune", "hunter_shot_bypasses"]).default("night_shot_immune"),
});
export const EVIL_KNIGHT_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.EvilKnight,
  maxCount: 1,
  canSelfDestruct: false,
  toolSpecs: (WOLF_ROLE_PROFILE.toolSpecs ?? []).filter(
    (spec) => spec.name !== "self_destruct" && spec.name !== "self_destruct_with_target",
  ),
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.Wolf,
    Role.EvilKnight,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
  ],
  label: roleName("evil_knight"),
  skillBrief: text("zh-CN", "role.evil_knight.brief"),
  init: (role, ctx) => {
    role.privateState.evilKnight = freshEvilKnightState(
      parameters.parse(ctx.boardConfig?.evilKnight ?? {}).shotPolicy,
    );
  },
  ...nativeRolePresentation("evil_knight"),
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, evilKnight: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.evilKnight ?? {}),
  },
  nightStages: [EVIL_KNIGHT_FRAME_STAGE, ...(WOLF_ROLE_PROFILE.nightStages ?? [])],
};
