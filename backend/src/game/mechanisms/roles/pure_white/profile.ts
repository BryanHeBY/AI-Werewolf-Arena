/**
 * Owns Pure White/Wolf Witch configured profiles and inspection contributions.
 * Inputs are original board parameters, initialization state and request context;
 * outputs preserve supported roles, prompt knowledge and existing tool policies.
 * Role-inspection keeps its stored references and writes; these profiles never
 * perform simultaneous effects, resolve a death chain or close a night frame.
 */
import { z } from "zod";
import { roleName, text, inspectionLabel, PURE_WHITE_POLICY } from "@ai-werewolf-arena/game-text";
import { Camp, Role, WinCondition } from "../../../../core/domain/model";
import { ELIMINATION_PRIORITIES } from "../../../../core/domain/board";
import type { RoleProfile } from "../contracts";
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
const inspectionBaseline: NonNullable<RoleProfile["baselineAction"]> = (
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
function inspectionPrompt(
  role: Parameters<NonNullable<RoleProfile["renderPrompt"]>>[0],
  locale: Parameters<typeof text>[0],
  wolf: boolean,
): string {
  const report = getRoleInspectionState(role)?.history.at(-1);
  return (
    text(locale, wolf ? "role.wolf_witch.state" : "role.pure_white_girl.state") +
    (report
      ? " " +
        text(locale, "inspection.latest", {
          target: report.targetId,
          result: inspectionLabel(report.result, locale),
        })
      : "")
  );
}
export const PURE_WHITE_ROLE_PROFILE: RoleProfile = {
  role: Role.PureWhiteGirl,
  camp: Camp.Good,
  goodSide: "god",
  maxCount: 1,
  canSelfDestruct: false,
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: boardRoles,
  label: roleName("pure_white_girl"),
  skillBrief: text("zh-CN", "role.pure_white_girl.brief"),
  init: (role) =>
    setRoleInspectionState(role, {
      policy: "pure_white",
      lastTarget: null,
      lastDay: null,
      history: [],
    }),
  renderPrompt: (role, locale = "zh-CN") => inspectionPrompt(role, locale, false),
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
};
export const WOLF_WITCH_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.WolfWitch,
  maxCount: 1,
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: boardRoles,
  label: roleName("wolf_witch"),
  skillBrief: text("zh-CN", "role.wolf_witch.brief"),
  init: (role) =>
    setRoleInspectionState(role, {
      policy: "wolf_witch",
      lastTarget: null,
      lastDay: null,
      history: [],
    }),
  renderPrompt: (role, locale = "zh-CN") => inspectionPrompt(role, locale, true),
  configuration: {
    schema: wolfParameters,
    defaults: wolfParameters.parse({}),
    apply: (config, value) => ({ ...config, wolfWitch: wolfParameters.parse(value) }),
    serialize: (config) => wolfParameters.parse(config.wolfWitch ?? {}),
  },
  toolSpecs: [...(WOLF_ROLE_PROFILE.toolSpecs ?? []), PURE_WHITE_INSPECTION_TOOL],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    inspect_night_identity: validatePureWhiteInspection,
  },
  nightStages: [...(WOLF_ROLE_PROFILE.nightStages ?? []), WOLF_WITCH_INSPECTION_STAGE],
  possibleNightAbilities: ["role_check"],
  baselineAction: (...args) =>
    args[1].allowedTools.includes("inspect_night_identity")
      ? inspectionBaseline(...args)
      : (WOLF_ROLE_PROFILE.baselineAction?.(...args) ?? null),
};
