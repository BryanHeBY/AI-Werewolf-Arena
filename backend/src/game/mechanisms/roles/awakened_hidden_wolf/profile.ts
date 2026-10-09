import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { DEATH_SHOT_TOOL_SPECS, DEATH_SHOT_REPAIR, validateDeathShot } from "../death_shot";
import { ROLE_INSPECTION_TOOL, roleInspectionTargets, validateRoleInspection } from "../role_inspection/rules";
import { findNightAbility } from "../abilities";
import { numberOrNull } from "../../llm/helpers";
import { canAwakenedKnife } from "./inheritance";
import { awakenedDeathHook } from "./death_hook";
import { AWAKENED_NIGHT_STAGES } from "./night_stages";
import { AWAKENED_TOOL_SPECS } from "./tool_specs";
import { AWAKENED_TOOL_NAMES, AWAKENED_VALIDATION_RULES } from "./rules";
import { freshAwakenedState, getAwakenedState, projectAwakenedState, setAwakenedState } from "./state";

export const AWAKENED_HIDDEN_WOLF_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE, role: Role.AwakenedHiddenWolf, camp: Camp.Wolf, maxCount: 1, canSelfDestruct: false,
  supportedBoardRoles: [Role.AwakenedHiddenWolf, Role.Wolf, Role.MirrorGirl, Role.Witch, Role.Hunter, Role.Guard, Role.Villager],
  label: roleName("awakened_hidden_wolf"), skillBrief: text("zh-CN", "role.awakened_hidden_wolf.brief"),
  init: role => { if (!getAwakenedState(role)) setAwakenedState(role, freshAwakenedState()); },
  wolfTeam: (role, world) => ({ recognizedByPack: false, recognizes: "none", canChat: false, canVoteForKill: canAwakenedKnife(role, world) }),
  inspectionLabels: role => ({ camp: Camp.Wolf, role: getAwakenedState(role)?.learned?.role ?? Role.AwakenedHiddenWolf }),
  configuration: { schema: z.strictObject({}), defaults: {}, apply: config => config },
  possibleNightAbilities: ["role_check"],
  renderPrompt: (role, locale = "zh-CN") => {
    const raw = getAwakenedState(role), state = raw && projectAwakenedState(raw), learned = state?.learned, none = text(locale, "common.none");
    return text(locale, "role.awakened_hidden_wolf.state") + " " + text(locale, "role.awakened_hidden_wolf.status", {
      learned: learned ? roleName(learned.role, locale) : none, activation: learned?.activationNight ?? none, ready: learned?.activeFromNight ?? none,
      inherited: text(locale, state?.hasInheritedKnife ? "common.yes" : "common.no"), first: state?.firstKnifeNight ?? none, resources: JSON.stringify(learned?.skill ?? null),
    });
  },
  toolSpecs: [...WOLF_ROLE_PROFILE.toolSpecs!.filter(spec => spec.name === "kill_vote"), ...AWAKENED_TOOL_SPECS, ROLE_INSPECTION_TOOL, ...DEATH_SHOT_TOOL_SPECS],
  nightStages: [...AWAKENED_NIGHT_STAGES, ...WOLF_ROLE_PROFILE.nightStages!],
  validationRules: { ...WOLF_ROLE_PROFILE.validationRules, ...AWAKENED_VALIDATION_RULES, inspect_role: validateRoleInspection,
    shoot: ctx => { const learned = getAwakenedState(ctx.role)?.learned, gun = learned?.skill; return validateDeathShot(ctx, ctx.role.role === Role.AwakenedHiddenWolf && ctx.role.camp === Camp.Wolf && learned?.role === Role.Hunter && learned.activationNight != null && gun?.kind === "hunter" && gun.armed && gun.canShoot); } },
  deathHook: awakenedDeathHook,
  llmRepair: { coerce: { ...WOLF_ROLE_PROFILE.llmRepair?.coerce, ...DEATH_SHOT_REPAIR.coerce,
    ...Object.fromEntries([...AWAKENED_TOOL_NAMES, "inspect_role"].map(name => [name, (args: Record<string, unknown>) => {
      if (args.target_id === null && ["awakened_guard", "awakened_attack"].includes(name)) return { target_id: null };
      const target = numberOrNull(args.target_id); return target === null ? null : { target_id: target };
    }])) } },
  baselineAction: (role, request, pick, byCamp, locale, world) => {
    if (request.allowedTools.includes("awakened_mimic")) { const target = pick(); return target === null ? null : { name: "awakened_mimic", args: { target_id: target } }; }
    if (request.allowedTools.includes("awakened_poison")) { const target = byCamp("good"); return target === null ? null : { name: "awakened_poison", args: { target_id: target } }; }
    if (request.allowedTools.includes("awakened_guard")) return { name: "awakened_guard", args: { target_id: null } };
    if (request.allowedTools.includes("awakened_attack")) return { name: "awakened_attack", args: { target_id: byCamp("good") } };
    if (request.allowedTools.includes("inspect_role")) {
      const ability = findNightAbility(role, "role_check", request.context.ability_id), target = world && ability ? roleInspectionTargets(world, request.actorId, ability.state)[0] : undefined;
      return target === undefined ? null : { name: "inspect_role", args: { target_id: target } };
    }
    if (request.allowedTools.includes("shoot")) return { name: "shoot", args: { target_id: byCamp("good") } };
    return WOLF_ROLE_PROFILE.baselineAction!(role, request, pick, byCamp, locale, world);
  },
};
