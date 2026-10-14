/**
 * 负责 恶夜骑士 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, WinCondition } from "../../../../core/domain/identity";
import type { NativeRoleContributions } from "../contracts";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { EVIL_KNIGHT_POLICY, EVIL_KNIGHT_STATE_SLOT, getEvilKnightState } from "./state-slot";
import { EVIL_KNIGHT_FRAME_STAGE } from "./night_frame";
const parameters = z.strictObject({
  policy: z.literal(EVIL_KNIGHT_POLICY).default(EVIL_KNIGHT_POLICY),
  shotPolicy: z.enum(["night_shot_immune", "hunter_shot_bypasses"]).default("night_shot_immune"),
});
export const EVIL_KNIGHT_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.EvilKnight,
    maxCount: 1,
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
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    canSelfDestruct: false,
    toolSpecs: (ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs ?? []).filter(
      (spec) => spec.name !== "self_destruct" && spec.name !== "self_destruct_with_target",
    ),
    init: (role, ctx) => {
      // 左值容器先读，原参数解析仍在 creator 的参数位置晚执行；失败不提前安装状态。
      EVIL_KNIGHT_STATE_SLOT.install(
        () => role.privateState,
        () => parameters.parse(ctx.boardConfig?.evilKnight ?? {}).shotPolicy,
      );
    },
    configuration: {
      schema: parameters,
      defaults: parameters.parse({}),
      apply: (config, value) => ({ ...config, evilKnight: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.evilKnight ?? {}),
    },
    nightStages: [EVIL_KNIGHT_FRAME_STAGE, ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages ?? [])],
  },
  presentation: nativeRolePresentation("evil_knight"),
};
