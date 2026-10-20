/**
 * 负责 通灵师 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { inspectionConfiguration } from "../role-inspection/contribution-ports";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { Camp, Role } from "../../domain/model";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { getRoleInspectionState, setRoleInspectionState } from "../role-inspection/ports";
import { numberOrNull } from "../../agents/tool-repair/helpers";
import { PSYCHIC_INSPECTION_STAGE } from "../role-inspection/contribution-ports";
import {
  ROLE_INSPECTION_TOOL,
  validateRoleInspection,
  roleInspectionTargets,
} from "../role-inspection/contribution-ports";

export const PSYCHIC_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Psychic,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    label: roleName("psychic"),
    skillBrief: text("zh-CN", "role.psychic.brief"),
  },
  runtime: {
    init: ownRoleCallback("init", {
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
    }),
    // 此处仍按原时点创建政策配置；共享工具／规则／阶段保同一绑定，不授查验库存或跳过租约复验。
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
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (role, request, pickAliveNotSelf, _camp, _locale, world) => {
        if (!request.allowedTools.includes("inspect_role")) return null;
        const state = getRoleInspectionState(role, request.context.ability_id);
        const target =
          world && state
            ? (roleInspectionTargets(world, request.actorId, state)[0] ?? null)
            : pickAliveNotSelf();
        return target === null ? null : { name: "inspect_role", args: { target_id: target } };
      },
    }),
  },
  presentation: nativeRolePresentation("psychic"),
};
