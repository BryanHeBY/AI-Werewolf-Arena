/**
 * Defines Fragrant Phantom and Awakened Seer configuration, tools and role hooks.
 * Inputs are role components, parameters and current request context; outputs
 * retain native state initialization, prompts and finite tool/stage registration.
 * Pair initialization belongs to its concrete slot owner; this profile never
 * commits inspection history, pays a request or resolves a death wave.
 */
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role, WinCondition } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { freshFragrantState, FRAGRANT_PAIR_POLICY } from "./state";
import { installPairStateSlot } from "./pair-state-slot";
import { fragrantKnownWolfIds, fragrantRoleKnifeEligible } from "./authority";
import { canSubmitFragrantPairChoice } from "./requests";
import { FRAGRANT_BIND_STAGE, PAIR_INSPECTION_STAGE } from "./night_stages";
const policy = z.strictObject({
  policy: z.literal(FRAGRANT_PAIR_POLICY).default(FRAGRANT_PAIR_POLICY),
});
const common = {
  maxCount: 1,
  supportedBoardRoles: [
    Role.FragrantPhantom,
    Role.AwakenedSeer,
    Role.Wolf,
    Role.Villager,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
  ],
  supportedWinConditions: [WinCondition.SlaughterSide],
  configuration: {
    schema: policy,
    defaults: policy.parse({}),
    apply: (
      config: Parameters<NonNullable<RoleProfile["configuration"]>["apply"]>[0],
      value: unknown,
    ) => ({ ...config, fragrantPairSeer: policy.parse(value) }),
    serialize: (config: Parameters<NonNullable<RoleProfile["configuration"]>["serialize"]>[0]) =>
      policy.parse(config.fragrantPairSeer ?? {}),
  },
};
const pairSchema = {
  type: "array",
  items: { type: "integer", minimum: 1 },
  minItems: 2,
  maxItems: 2,
  uniqueItems: true,
};
export const FRAGRANT_PHANTOM_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  ...common,
  role: Role.FragrantPhantom,
  camp: Camp.Wolf,
  label: roleName("fragrant_phantom"),
  skillBrief: text("zh-CN", "role.fragrant_phantom.brief"),
  canSelfDestruct: false,
  wolfTeam: (role, world) => ({
    recognizedByPack: false,
    recognizes: "none",
    canChat: false,
    canVoteForKill: !!world && fragrantRoleKnifeEligible(world, role),
  }),
  knownTeammates: (role, world) => fragrantKnownWolfIds(world, role),
  init: (role) => {
    role.privateState.fragrant = freshFragrantState();
  },
  renderPrompt: (_role, locale = "zh-CN") => text(locale, "role.fragrant_phantom.brief"),
  toolSpecs: [
    ...(WOLF_ROLE_PROFILE.toolSpecs ?? []).filter((s) => s.name === "kill_vote"),
    {
      name: "bind_fragrant_pair",
      parameters: {
        type: "object",
        properties: { target_ids: { ...pairSchema, type: ["array", "null"] } },
        required: ["target_ids"],
        additionalProperties: false,
      },
      argHint: 'bind_fragrant_pair args: {"target_ids":[number,number]|null}',
      userPromptHintKey: "action.bind_fragrant_pair.hint",
    },
  ],
  stageDirectives: [
    ...(WOLF_ROLE_PROFILE.stageDirectives ?? []),
    {
      match: (tools) => tools.length === 1 && tools[0] === "bind_fragrant_pair",
      messageKey: "action.bind_fragrant_pair.directive",
      text: text("zh-CN", "action.bind_fragrant_pair.directive"),
    },
  ],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    bind_fragrant_pair: ({ world, actorId, phase, day, fragrantPairScope, toolCall }) =>
      canSubmitFragrantPairChoice(world, actorId, phase, day ?? 0, fragrantPairScope, toolCall)
        ? null
        : { code: RuleError.FragrantPairUnavailable },
  },
  nightStages: [...(WOLF_ROLE_PROFILE.nightStages ?? []), FRAGRANT_BIND_STAGE],
  baselineAction: (role, request, ...rest) =>
    request.allowedTools.includes("bind_fragrant_pair")
      ? { name: "bind_fragrant_pair", args: { target_ids: null } }
      : (WOLF_ROLE_PROFILE.baselineAction?.(role, request, ...rest) ?? null),
};
export const AWAKENED_SEER_ROLE_PROFILE: RoleProfile = {
  ...common,
  role: Role.AwakenedSeer,
  camp: Camp.Good,
  goodSide: "god",
  canSelfDestruct: false,
  label: roleName("awakened_seer"),
  skillBrief: text("zh-CN", "role.awakened_seer.brief"),
  init: (role) => {
    installPairStateSlot(role);
  },
  renderPrompt: (_role, locale = "zh-CN") => text(locale, "role.awakened_seer.brief"),
  toolSpecs: [
    {
      name: "check_pair",
      parameters: {
        type: "object",
        properties: { target_ids: pairSchema },
        required: ["target_ids"],
        additionalProperties: false,
      },
      argHint: 'check_pair args: {"target_ids":[number,number]}',
      userPromptHintKey: "action.check_pair.hint",
    },
  ],
  stageDirectives: [
    {
      match: (tools) => tools.length === 1 && tools[0] === "check_pair",
      messageKey: "action.check_pair.directive",
      text: text("zh-CN", "action.check_pair.directive"),
    },
  ],
  validationRules: {
    check_pair: ({ world, actorId, phase, day, fragrantPairScope, toolCall }) =>
      canSubmitFragrantPairChoice(world, actorId, phase, day ?? 0, fragrantPairScope, toolCall)
        ? null
        : { code: RuleError.FragrantPairUnavailable },
  },
  nightStages: [PAIR_INSPECTION_STAGE],
  baselineAction: (_role, request) => {
    const ids = request.context.pair_check_candidates;
    return request.allowedTools.includes("check_pair") && ids && ids.length >= 2
      ? { name: "check_pair", args: { target_ids: [ids[0]!, ids[1]!] } }
      : null;
  },
};
