/**
 * 负责 隐狼 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { HIDDEN_WOLF_CAMP_INSPECTION_POLICIES } from "../../../../core/domain/board";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../../../core/domain/model";
import type { NativeRoleContributions } from "../contracts";
import { getHiddenWolfState, setHiddenWolfState } from "./state";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { canHiddenWolfKnife } from "./inheritance";

const parameters = z.strictObject({
  campInspection: z.enum(HIDDEN_WOLF_CAMP_INSPECTION_POLICIES).default("awa_inheritance_v1"),
});

export const HIDDEN_WOLF_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.HiddenWolf,
    maxCount: 1,
    label: roleName("hidden_wolf"),
    skillBrief: text("zh-CN", "role.hidden_wolf.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    canSelfDestruct: false,
    init: (role, ctx) => {
      setHiddenWolfState(role, {
        hasInheritedKnife: false,
        ...(ctx.boardConfig?.hiddenWolf?.campInspection === "netease_2020_good_v1"
          ? { campInspection: ctx.boardConfig.hiddenWolf.campInspection }
          : {}),
      });
    },
    wolfTeam: (role, world) => ({
      recognizedByPack: false,
      recognizes: "all",
      canChat: false,
      canVoteForKill: canHiddenWolfKnife(role, world),
    }),
    inspectionLabels: (role) => {
      const state = getHiddenWolfState(role),
        inherited = state?.hasInheritedKnife === true;
      return {
        camp:
          state?.campInspection === "netease_2020_good_v1"
            ? Camp.Good
            : inherited
              ? Camp.Wolf
              : Camp.Good,
        role: inherited ? Role.HiddenWolf : Role.Villager,
      };
    },
    detectableByBear: (_world, role) => getHiddenWolfState(role)?.hasInheritedKnife === true,
    configuration: {
      schema: parameters,
      defaults: { campInspection: "awa_inheritance_v1" },
      apply: (config, value) => ({ ...config, hiddenWolf: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.hiddenWolf ?? {}),
    },
    toolSpecs: ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs!.filter((spec) => spec.name === "kill_vote"),
  },
  presentation: nativeRolePresentation("hidden_wolf"),
};
