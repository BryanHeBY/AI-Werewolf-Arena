import { z } from "zod";
import { roleName, text, inspectionLabel } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getRoleInspectionState, setRoleInspectionState } from "../private_state";
import { numberOrNull } from "../../llm/helpers";
import { PSYCHIC_INSPECTION_STAGE } from "../role_inspection/night_stages";
import { ROLE_INSPECTION_TOOL, validateRoleInspection } from "../role_inspection/rules";

export const PSYCHIC_ROLE_PROFILE: RoleProfile = {
  role: Role.Psychic, camp: Camp.Good, goodSide: "god", maxCount: 1,
  label: roleName("psychic"), skillBrief: text("zh-CN", "role.psychic.brief"),
  init: role => { setRoleInspectionState(role, { policy: "psychic", lastTarget: null, lastDay: null, history: [] }); },
  renderPrompt: (role, locale = "zh-CN") => {
    const report = getRoleInspectionState(role)?.history.at(-1);
    return text(locale, "role.psychic.state") + (report ? " " + text(locale, "inspection.latest", { target: report.targetId, result: inspectionLabel(report.result, locale) }) : "");
  },
  configuration: { schema: z.strictObject({}), defaults: {}, apply: config => config, serialize: () => ({}) },
  toolSpecs: [ROLE_INSPECTION_TOOL], validationRules: { inspect_role: validateRoleInspection },
  nightStages: [PSYCHIC_INSPECTION_STAGE], possibleNightAbilities: ["role_check"],
  llmRepair: { coerce: { inspect_role: args => { const target = numberOrNull(args.target_id); return target === null ? null : { target_id: target }; } } },
  baselineAction: (_role, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("inspect_role")) return null;
    const target = pickAliveNotSelf();
    return target === null ? null : { name: "inspect_role", args: { target_id: target } };
  },
};
