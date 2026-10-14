/**
 * 负责 石像鬼 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { inspectionConfiguration } from "../role_inspection/contribution-ports";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { Role } from "../../../../core/domain/model";
import type { NativeRoleContributions } from "../contracts";
import { getGargoyleState, setGargoyleState } from "./state";
import { getRoleInspectionState, setRoleInspectionState } from "../role_inspection/ports";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { numberOrNull } from "../../llm/helpers";
import { canGargoyleKnife } from "./inheritance";
import { ROLE_INSPECTION_STAGE } from "../role_inspection/contribution-ports";

import {
  ROLE_INSPECTION_TOOL,
  validateRoleInspection,
  roleInspectionTargets,
} from "../role_inspection/contribution-ports";

export const GARGOYLE_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.Gargoyle,
    maxCount: 1,
    label: roleName("gargoyle"),
    skillBrief: text("zh-CN", "role.gargoyle.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    canSelfDestruct: false,
    init: (role, ctx) => {
      setGargoyleState(role, { hasInheritedKnife: false });
      setRoleInspectionState(role, {
        lastTarget: null,
        lastDay: null,
        history: [],
        ...(ctx.boardConfig?.gargoyle?.inspectionPolicy &&
        ctx.boardConfig.gargoyle.inspectionPolicy !== "awa_unique_required_v1"
          ? { inspectionPolicy: ctx.boardConfig.gargoyle.inspectionPolicy }
          : {}),
      });
    },
    wolfTeam: (role, world, currentCamp) => ({
      recognizedByPack: false,
      recognizes: "none",
      canChat: false,
      canVoteForKill: canGargoyleKnife(role, world, currentCamp),
    }),
    // 此处仍按原时点创建政策配置；共享工具／规则／阶段保同一绑定，不授查验库存或跳过租约复验。
    configuration: inspectionConfiguration("gargoyle", "awa_unique_required_v1"),
    nightStages: [ROLE_INSPECTION_STAGE, ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages!],
    possibleNightAbilities: ["role_check"],
    toolSpecs: [
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs!.filter((spec) => spec.name === "kill_vote"),
      ROLE_INSPECTION_TOOL,
    ],
    validationRules: {
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      inspect_role: validateRoleInspection,
    },
    llmRepair: {
      coerce: {
        ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.llmRepair?.coerce,
        inspect_role: (args) => {
          const target = numberOrNull(args.target_id);
          return target === null ? null : { target_id: target };
        },
      },
    },
    baselineAction: (role, request, pick, byCamp, locale, world, currentCamp) => {
      if (request.allowedTools.includes("inspect_role")) {
        const state = getRoleInspectionState(role, request.context.ability_id),
          target = world && state ? roleInspectionTargets(world, request.actorId, state)[0] : null;
        return target === null || target === undefined
          ? null
          : { name: "inspect_role", args: { target_id: target } };
      }
      return ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction!(role, request, pick, byCamp, locale, world, currentCamp);
    },
  },
  presentation: nativeRolePresentation("gargoyle"),
};
