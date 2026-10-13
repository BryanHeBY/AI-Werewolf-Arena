/**
 * 负责 守墓人 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { readGravekeeperReport } from "@ai-werewolf-arena/replay-contract";
import { Camp, Role } from "../../../../core/domain/model";
import type { NativeRoleContributions } from "../contracts";
import { getGravekeeperState, setGravekeeperState } from "./state";
import { GRAVEKEEPER_FEEDBACK_STAGE } from "./feedback";

export const GRAVEKEEPER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Gravekeeper,
    camp: Camp.Good,
    goodSide: "god",
    label: roleName("gravekeeper"),
    skillBrief: text("zh-CN", "role.gravekeeper.brief"),
  },
  runtime: {
    init: (role) => {
      setGravekeeperState(role, { history: [] });
    },
    configuration: {
      schema: z.strictObject({}),
      defaults: {},
      apply: (config) => config,
      serialize: () => ({}),
    },
    nightStages: [GRAVEKEEPER_FEEDBACK_STAGE],
  },
  presentation: nativeRolePresentation("gravekeeper"),
};
