/**
 * 负责 通灵师 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { inspectionConfiguration, renderInspectionPolicy } from "../role_inspection/policies";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getRoleInspectionState, setRoleInspectionState } from "../role_inspection/ports";
import { numberOrNull } from "../../llm/helpers";
import { PSYCHIC_INSPECTION_STAGE } from "../role_inspection/night_stages";
import {
  ROLE_INSPECTION_TOOL,
  validateRoleInspection,
  roleInspectionTargets,
} from "../role_inspection/rules";

export const PSYCHIC_ROLE_PROFILE: RoleProfile = {
  role: Role.Psychic,
  camp: Camp.Good,
  goodSide: "god",
  maxCount: 1,
  label: roleName("psychic"),
  skillBrief: text("zh-CN", "role.psychic.brief"),
  init: (role, ctx) => {
    setRoleInspectionState(role, {
      policy: "psychic",
      ...(ctx.boardConfig?.psychic?.inspectionPolicy &&
      ctx.boardConfig.psychic.inspectionPolicy !== "awa_repeat_optional_v1"
        ? { inspectionPolicy: ctx.boardConfig.psychic.inspectionPolicy }
        : {}),
      lastTarget: null,
      lastDay: null,
      history: [],
    });
  },
  ...nativeRolePresentation("psychic"),
  configuration: inspectionConfiguration("psychic", "awa_repeat_optional_v1"),
  toolSpecs: [ROLE_INSPECTION_TOOL],
  validationRules: { inspect_role: validateRoleInspection },
  nightStages: [PSYCHIC_INSPECTION_STAGE],
  possibleNightAbilities: ["role_check"],
  llmRepair: {
    coerce: {
      inspect_role: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target };
      },
    },
  },
  baselineAction: (role, request, pickAliveNotSelf, _camp, _locale, world) => {
    if (!request.allowedTools.includes("inspect_role")) return null;
    const state = getRoleInspectionState(role, request.context.ability_id);
    const target =
      world && state
        ? (roleInspectionTargets(world, request.actorId, state)[0] ?? null)
        : pickAliveNotSelf();
    return target === null ? null : { name: "inspect_role", args: { target_id: target } };
  },
};
