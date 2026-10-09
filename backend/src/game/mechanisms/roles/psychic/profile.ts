import { inspectionConfiguration, renderInspectionPolicy } from "../role_inspection/policies";
import { roleName, text, inspectionLabel } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getRoleInspectionState, setRoleInspectionState } from "../private_state";
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
  renderPrompt: (role, locale = "zh-CN") => {
    const report = getRoleInspectionState(role)?.history.at(-1);
    return (
      text(
        locale,
        getRoleInspectionState(role)?.inspectionPolicy
          ? "role.psychic.configured_identity"
          : "role.psychic.state",
      ) +
      " " +
      renderInspectionPolicy(getRoleInspectionState(role)!, locale) +
      (report
        ? " " +
          text(locale, "inspection.latest", {
            target: report.targetId,
            result: inspectionLabel(report.result, locale),
          })
        : "")
    );
  },
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
