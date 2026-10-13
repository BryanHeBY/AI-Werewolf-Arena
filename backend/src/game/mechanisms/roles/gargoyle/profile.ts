/**
 * 负责装配石像鬼的身份查验、刀权继承与原生状态贡献。输入为原板子参数、初始化组件、请求上下文与语言；输出保持既有 RoleProfile、提示和目标政策。状态引用和接受后的写入仍归具体机制 owner，本模块不创建第二仓库、授权 lease、执行伤害或编码归档。
 */
import { inspectionConfiguration, renderInspectionPolicy } from "../role_inspection/policies";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getGargoyleState, setGargoyleState } from "./state";
import { getRoleInspectionState, setRoleInspectionState } from "../role_inspection/ports";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { numberOrNull } from "../../llm/helpers";
import { canGargoyleKnife } from "./inheritance";
import { ROLE_INSPECTION_STAGE } from "../role_inspection/night_stages";

import {
  ROLE_INSPECTION_TOOL,
  validateRoleInspection,
  roleInspectionTargets,
} from "../role_inspection/rules";

export const GARGOYLE_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.Gargoyle,
  maxCount: 1,
  canSelfDestruct: false,
  label: roleName("gargoyle"),
  skillBrief: text("zh-CN", "role.gargoyle.brief"),
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
  wolfTeam: (role, world) => ({
    recognizedByPack: false,
    recognizes: "none",
    canChat: false,
    canVoteForKill: canGargoyleKnife(role, world),
  }),
  renderPrompt: (role, locale = "zh-CN", world) => {
    const report = getRoleInspectionState(role)?.history.at(-1);
    return (
      text(
        locale,
        getRoleInspectionState(role)?.inspectionPolicy
          ? "role.gargoyle.configured_identity"
          : "role.gargoyle.state",
      ) +
      " " +
      renderInspectionPolicy(getRoleInspectionState(role)!, locale) +
      " " +
      text(locale, "role.gargoyle.status", {
        inherited: text(
          locale,
          getGargoyleState(role)?.hasInheritedKnife === true ? "common.yes" : "common.no",
        ),
        active: text(locale, canGargoyleKnife(role, world) ? "common.yes" : "common.no"),
      }) +
      (report
        ? " " +
          text(locale, "inspection.latest", {
            target: report.targetId,
            result: inspectionLabel(report.result, locale),
          })
        : "")
    );
  },
  configuration: inspectionConfiguration("gargoyle", "awa_unique_required_v1"),
  nightStages: [ROLE_INSPECTION_STAGE, ...WOLF_ROLE_PROFILE.nightStages!],
  possibleNightAbilities: ["role_check"],
  toolSpecs: [
    ...WOLF_ROLE_PROFILE.toolSpecs!.filter((spec) => spec.name === "kill_vote"),
    ROLE_INSPECTION_TOOL,
  ],
  validationRules: { ...WOLF_ROLE_PROFILE.validationRules, inspect_role: validateRoleInspection },
  llmRepair: {
    coerce: {
      ...WOLF_ROLE_PROFILE.llmRepair?.coerce,
      inspect_role: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target };
      },
    },
  },
  baselineAction: (role, request, pick, byCamp, locale, world) => {
    if (request.allowedTools.includes("inspect_role")) {
      const state = getRoleInspectionState(role, request.context.ability_id),
        target = world && state ? roleInspectionTargets(world, request.actorId, state)[0] : null;
      return target === null || target === undefined
        ? null
        : { name: "inspect_role", args: { target_id: target } };
    }
    return WOLF_ROLE_PROFILE.baselineAction!(role, request, pick, byCamp, locale, world);
  },
};
