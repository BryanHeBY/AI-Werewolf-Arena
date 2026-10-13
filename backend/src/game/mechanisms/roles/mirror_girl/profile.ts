/**
 * 负责装配镜女的配置、原生初始化与查验／工具贡献。输入为原板子参数、初始化组件、请求上下文与语言；输出保持既有 RoleProfile、提示和目标政策。状态引用和接受后的写入仍归具体机制 owner，本模块不创建第二仓库、授权 lease、执行伤害或编码归档。
 */

import type { RoleInspectionState } from "@ai-werewolf-arena/game-contract";
import { inspectionConfiguration, renderInspectionPolicy } from "../role_inspection/policies";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
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

export const freshMirrorInspectionState = (): RoleInspectionState => ({
  policy: "mirror",
  lastTarget: null,
  lastDay: null,
  history: [],
});
const nativeMirror = (role: RoleComponent) =>
  allNightAbilities(role).find(
    (ability) =>
      ability.kind === "role_check" &&
      ability.source.kind === "native" &&
      ability.source.role === Role.MirrorGirl,
  );

export const MIRROR_GIRL_ROLE_PROFILE: RoleProfile = {
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
  init: (role, ctx) => {
    const native = nativeMirror(role);
    if (native?.kind === "role_check" && roleInspectionPolicy(native.state) !== "mirror")
      throw new Error("mirror_native_policy_invalid");
    // Reapplication/revival must neither reset a live native history nor replenish a transferred one.
    if (!native && !retiredNightAbilityIds(role).some((id) => id.startsWith("native:role_check")))
      setRoleInspectionState(role, {
        ...freshMirrorInspectionState(),
        ...(ctx.boardConfig?.mirrorGirl?.inspectionPolicy &&
        ctx.boardConfig.mirrorGirl.inspectionPolicy !== "awa_unique_optional_v1"
          ? { inspectionPolicy: ctx.boardConfig.mirrorGirl.inspectionPolicy }
          : {}),
      });
  },
  renderPrompt: (role, locale = "zh-CN") => {
    const native = nativeMirror(role),
      report = native?.kind === "role_check" ? native.state.history.at(-1) : undefined;
    return (
      text(
        locale,
        native?.kind === "role_check" && native.state.inspectionPolicy
          ? "role.mirror_girl.configured_identity"
          : "role.mirror_girl.state",
      ) +
      " " +
      renderInspectionPolicy(
        native?.kind === "role_check" ? native.state : freshMirrorInspectionState(),
        locale,
      ) +
      (report
        ? " " +
          text(locale, "inspection.latest", {
            target: report.targetId,
            result: inspectionLabel(report.result, locale),
          })
        : "")
    );
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
};
