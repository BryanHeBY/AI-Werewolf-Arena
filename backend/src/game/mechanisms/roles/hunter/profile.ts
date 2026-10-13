/**
 * 负责 猎人 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { deathActionConfiguration, renderDeathActionPolicy } from "../death_action_policy";
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：猎人角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getHunterState, setHunterState } from "./state";
import { hunterDeathHook } from "./death_hook";
import { HUNTER_TOOL_SPECS } from "./tool_specs";
import { DEATH_SHOT_REPAIR, validateDeathShot } from "../death_shot";

/** 猎人角色配置。 */
export const HUNTER_ROLE_PROFILE: RoleProfile = {
  role: Role.Hunter,
  camp: Camp.Good,
  label: roleName("hunter"),
  skillBrief: text("zh-CN", "role.hunter.brief"),
  goodSide: "god",
  configuration: deathActionConfiguration("hunter"),
  init: (roleComp, ctx) => {
    setHunterState(roleComp, {
      canShoot: true,
      ...(ctx.boardConfig?.hunter?.deathActionPolicy === "awa_knife_or_exile_v1"
        ? { deathActionPolicy: ctx.boardConfig.hunter.deathActionPolicy }
        : {}),
    });
  },
  ...nativeRolePresentation("hunter"),
  toolSpecs: HUNTER_TOOL_SPECS,
  validationRules: {
    shoot: (ctx) =>
      validateDeathShot(
        ctx,
        ctx.role.role === Role.Hunter && getHunterState(ctx.role)?.canShoot === true,
      ),
  },
  llmRepair: DEATH_SHOT_REPAIR,
  deathHook: hunterDeathHook,
  baselineAction: (_roleComp, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("shoot")) {
      return null;
    }
    const target = pickAliveNotSelf();
    return { name: "shoot", args: { target_id: target } };
  },
};
