/**
 * 负责 白痴 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：白痴角色 profile。 */
import { Camp, Role } from "../../../../domain/model";
import { NativeRoleContributions } from "../contracts";
import { getIdiotState, initializeIdiotState } from "./state";
import { idiotVotedOutHook } from "../../../../rulesets/idiot-exile-outcome";

/** 白痴角色配置。 */
export const IDIOT_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Idiot,
    camp: Camp.Good,
    label: roleName("idiot"),
    skillBrief: text("zh-CN", "role.idiot.brief"),
    goodSide: "god",
  },
  runtime: {
    participation: (role) => {
      const enabled = getIdiotState(role)?.revealed !== true;
      return { canVote: enabled, canBeExiled: enabled, canBeSheriff: enabled };
    },
    init: initializeIdiotState,
    votedOutHook: idiotVotedOutHook,
  },
  presentation: nativeRolePresentation("idiot"),
};
