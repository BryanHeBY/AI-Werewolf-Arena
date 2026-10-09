import { z } from "zod";
import { roleName, text, inspectionLabel } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { setRoleInspectionState, type RoleInspectionState } from "../private_state";
import { allNightAbilities, findNightAbility, roleInspectionPolicy } from "../abilities";
import { numberOrNull } from "../../llm/helpers";
import { MIRROR_INSPECTION_STAGE } from "../role_inspection/night_stages";
import { ROLE_INSPECTION_TOOL, validateRoleInspection, roleInspectionTargets } from "../role_inspection/rules";

export const freshMirrorInspectionState = (): RoleInspectionState => ({ policy: "mirror", lastTarget: null, lastDay: null, history: [] });
const nativeMirror = (role: RoleComponent) => allNightAbilities(role).find(ability => ability.kind === "role_check" && ability.source.kind === "native" && ability.source.role === Role.MirrorGirl);

export const MIRROR_GIRL_ROLE_PROFILE: RoleProfile = {
  role: Role.MirrorGirl, camp: Camp.Good, goodSide: "god", maxCount: 1,
  label: roleName("mirror_girl"), skillBrief: text("zh-CN", "role.mirror_girl.brief"),
  supportedBoardRoles: [Role.MirrorGirl, Role.AwakenedHiddenWolf, Role.Wolf, Role.WolfKing, Role.HiddenWolf, Role.Gargoyle, Role.Psychic, Role.Seer, Role.Witch, Role.Guard, Role.Hunter, Role.Idiot, Role.Villager],
  init: role => {
    const native = nativeMirror(role);
    if (native?.kind === "role_check" && roleInspectionPolicy(native.state) !== "mirror") throw new Error("mirror_native_policy_invalid");
    // Reapplication/revival must neither reset a live native history nor replenish a transferred one.
    if (!native && !((role.privateState.retiredAbilityIds ?? []) as string[]).some(id => id.startsWith("native:role_check"))) setRoleInspectionState(role, freshMirrorInspectionState());
  },
  renderPrompt: (role, locale = "zh-CN") => {
    const native = nativeMirror(role), report = native?.kind === "role_check" ? native.state.history.at(-1) : undefined;
    return text(locale, "role.mirror_girl.state") + (report ? " " + text(locale, "inspection.latest", { target: report.targetId, result: inspectionLabel(report.result, locale) }) : "");
  },
  configuration: { schema: z.strictObject({}), defaults: {}, apply: config => config, serialize: () => ({}) },
  toolSpecs: [ROLE_INSPECTION_TOOL], validationRules: { inspect_role: validateRoleInspection },
  nightStages: [MIRROR_INSPECTION_STAGE], possibleNightAbilities: ["role_check"],
  llmRepair: { coerce: { inspect_role: args => { const target = numberOrNull(args.target_id); return target === null ? null : { target_id: target }; } } },
  baselineAction: (role, request, _pick, _byCamp, _locale, world) => {
    if (!world || !request.allowedTools.includes("inspect_role")) return null;
    const ability = findNightAbility(role, "role_check", request.context.ability_id), target = ability ? roleInspectionTargets(world, request.actorId, ability.state)[0] : undefined;
    return target === undefined ? null : { name: "inspect_role", args: { target_id: target } };
  },
};
