/**
 * 负责 魔镜少女 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */

import { nativeRolePresentation } from "../presentation-contribution";
import type { RoleInspectionState } from "@ai-werewolf-arena/game-contract";
import { inspectionConfiguration, renderInspectionPolicy } from "../role_inspection/policies";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { Camp, Role } from "../../../../core/domain/model";
import type { NativeRoleContributions } from "../contracts";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { setRoleInspectionState } from "../role_inspection/ports";
import {
  allNightAbilities,
  findNightAbility,
  roleInspectionPolicy,
  retiredNightAbilityIds,
} from "../abilities";
import { numberOrNull } from "../../llm/helpers";
import { MIRROR_INSPECTION_STAGE } from "../role_inspection/night_stages";
import {
  ROLE_INSPECTION_TOOL,
  validateRoleInspection,
  roleInspectionTargets,
} from "../role_inspection/rules";

import { nativeMirror, freshMirrorInspectionState } from "./native-inspection";
export { freshMirrorInspectionState } from "./native-inspection";

export const MIRROR_GIRL_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.MirrorGirl,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    label: roleName("mirror_girl"),
    skillBrief: text("zh-CN", "role.mirror_girl.brief"),
    supportedBoardRoles: [
      Role.CursedFox,
      Role.MirrorGirl,
      Role.AwakenedHiddenWolf,
      Role.Wolf,
      Role.WolfKing,
      Role.HiddenWolf,
      Role.Gargoyle,
      Role.Psychic,
      Role.Seer,
      Role.Witch,
      Role.Guard,
      Role.Hunter,
      Role.Idiot,
      Role.Villager,
    ],
  },
  runtime: {
    init: (role, ctx) => {
      const native = nativeMirror(role);
      if (native?.kind === "role_check" && roleInspectionPolicy(native.state) !== "mirror")
        throw new Error("mirror_native_policy_invalid");
      // 重复装配或复活不能重置仍存续的原生历史，也不能补充已经转移的查验资源。
      if (!native && !retiredNightAbilityIds(role).some((id) => id.startsWith("native:role_check")))
        setRoleInspectionState(role, {
          ...freshMirrorInspectionState(),
          ...(ctx.boardConfig?.mirrorGirl?.inspectionPolicy &&
          ctx.boardConfig.mirrorGirl.inspectionPolicy !== "awa_unique_optional_v1"
            ? { inspectionPolicy: ctx.boardConfig.mirrorGirl.inspectionPolicy }
            : {}),
        });
    },
    configuration: inspectionConfiguration("mirrorGirl", "awa_unique_optional_v1"),
    toolSpecs: [ROLE_INSPECTION_TOOL],
    validationRules: { inspect_role: validateRoleInspection },
    nightStages: [MIRROR_INSPECTION_STAGE],
    possibleNightAbilities: ["role_check"],
    llmRepair: {
      coerce: {
        inspect_role: (args) => {
          const target = numberOrNull(args.target_id);
          return target === null ? null : { target_id: target };
        },
      },
    },
    baselineAction: (role, request, _pick, _byCamp, _locale, world) => {
      if (!world || !request.allowedTools.includes("inspect_role")) return null;
      const ability = findNightAbility(role, "role_check", request.context.ability_id),
        target = ability
          ? roleInspectionTargets(world, request.actorId, ability.state)[0]
          : undefined;
      return target === undefined ? null : { name: "inspect_role", args: { target_id: target } };
    },
  },
  presentation: nativeRolePresentation("mirror_girl"),
};
