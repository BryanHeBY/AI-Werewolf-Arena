/**
 * 负责 纯白之女／狼巫 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text, PURE_WHITE_POLICY } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { Camp, Role, WinCondition } from "../../../../core/domain/model";
import { ELIMINATION_PRIORITIES } from "../../../../core/domain/board";
import type { NativeRoleContributions, RoleRuntimeContribution } from "../contracts";
import { getRoleInspectionState, setRoleInspectionState } from "../role_inspection/ports";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { PURE_WHITE_INSPECTION_STAGE, WOLF_WITCH_INSPECTION_STAGE } from "./night_stages";
import {
  PURE_WHITE_INSPECTION_TOOL,
  validatePureWhiteInspection,
  pureWhiteInspectionTargets,
} from "./rules";

const pureParameters = z.strictObject({
  policy: z.literal(PURE_WHITE_POLICY).default(PURE_WHITE_POLICY),
  eliminationPriority: z.enum(ELIMINATION_PRIORITIES).default("awa_wolf_priority_v1"),
});
const wolfParameters = z.strictObject({
  policy: z.literal(PURE_WHITE_POLICY).default(PURE_WHITE_POLICY),
});
const boardRoles = [
  Role.Wolf,
  Role.WolfWitch,
  Role.Villager,
  Role.PureWhiteGirl,
  Role.Witch,
  Role.Hunter,
  Role.Guard,
];
const inspectionBaseline: NonNullable<RoleRuntimeContribution["baselineAction"]> = (
  role,
  request,
  _pickOther,
  _pickCamp,
  _locale,
  world,
) => {
  if (!request.allowedTools.includes("inspect_night_identity")) return null;
  const policy = role.role === Role.PureWhiteGirl ? "pure_white" : "wolf_witch";
  const target = world
    ? (pureWhiteInspectionTargets(world, request.actorId, policy)[0] ?? null)
    : null;
  return { name: "inspect_night_identity", args: { target_id: target, abstain: target === null } };
};

export const PURE_WHITE_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.PureWhiteGirl,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: boardRoles,
    label: roleName("pure_white_girl"),
    skillBrief: text("zh-CN", "role.pure_white_girl.brief"),
  },
  runtime: {
    canSelfDestruct: false,
    init: (role) =>
      setRoleInspectionState(role, {
        policy: "pure_white",
        lastTarget: null,
        lastDay: null,
        history: [],
      }),
    configuration: {
      schema: pureParameters,
      defaults: pureParameters.parse({}),
      apply: (config, value) => ({ ...config, pureWhite: pureParameters.parse(value) }),
      serialize: (config) => pureParameters.parse(config.pureWhite ?? {}),
    },
    toolSpecs: [PURE_WHITE_INSPECTION_TOOL],
    validationRules: { inspect_night_identity: validatePureWhiteInspection },
    nightStages: [PURE_WHITE_INSPECTION_STAGE],
    possibleNightAbilities: ["role_check"],
    baselineAction: inspectionBaseline,
  },
  presentation: nativeRolePresentation("pure_white_girl"),
};
export const WOLF_WITCH_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...WOLF_ROLE_PROFILE.metadata,
    role: Role.WolfWitch,
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: boardRoles,
    label: roleName("wolf_witch"),
    skillBrief: text("zh-CN", "role.wolf_witch.brief"),
  },
  runtime: {
    ...WOLF_ROLE_PROFILE.runtime,
    init: (role) =>
      setRoleInspectionState(role, {
        policy: "wolf_witch",
        lastTarget: null,
        lastDay: null,
        history: [],
      }),
    configuration: {
      schema: wolfParameters,
      defaults: wolfParameters.parse({}),
      apply: (config, value) => ({ ...config, wolfWitch: wolfParameters.parse(value) }),
      serialize: (config) => wolfParameters.parse(config.wolfWitch ?? {}),
    },
    toolSpecs: [...(WOLF_ROLE_PROFILE.runtime.toolSpecs ?? []), PURE_WHITE_INSPECTION_TOOL],
    validationRules: {
      ...WOLF_ROLE_PROFILE.runtime.validationRules,
      inspect_night_identity: validatePureWhiteInspection,
    },
    nightStages: [...(WOLF_ROLE_PROFILE.runtime.nightStages ?? []), WOLF_WITCH_INSPECTION_STAGE],
    possibleNightAbilities: ["role_check"],
    baselineAction: (...args) =>
      args[1].allowedTools.includes("inspect_night_identity")
        ? inspectionBaseline(...args)
        : (WOLF_ROLE_PROFILE.runtime.baselineAction?.(...args) ?? null),
  },
  presentation: nativeRolePresentation("wolf_witch"),
};
