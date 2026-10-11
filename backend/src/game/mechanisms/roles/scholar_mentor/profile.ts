import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition, Phase } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { SCHOLAR_MENTOR_POLICY, createModifierState } from "./state";
import {
  scholarMentorStateForRole,
  scholarMentorChoicePending,
  scholarMentorChoiceTargets,
  scholarMentorRoleCanKnife,
  scholarMentorBonusTargets,
  captureScholarMentorBonus,
  isScholarMentorBoard,
} from "./night_frame";
import { SCHOLAR_MENTOR_NIGHT_STAGES } from "./night_stages";
const parameters = z.strictObject({
  policy: z.literal(SCHOLAR_MENTOR_POLICY).default(SCHOLAR_MENTOR_POLICY),
});
const supported = [
  Role.Wolf,
  Role.NightMentor,
  Role.Villager,
  Role.DayScholar,
  Role.Seer,
  Role.Witch,
  Role.Guard,
];
function profile(roleNameId: Role.DayScholar | Role.NightMentor): RoleProfile {
  const mentor = roleNameId === Role.NightMentor;
  const base = mentor ? WOLF_ROLE_PROFILE : undefined;
  return {
    ...base,
    role: roleNameId,
    camp: mentor ? Camp.Wolf : Camp.Good,
    goodSide: mentor ? undefined : "god",
    maxCount: 1,
    canSelfDestruct: false,
    wolfTeam: mentor
      ? (role, world) => ({
          recognizedByPack: true,
          recognizes: "none",
          canChat: false,
          canVoteForKill: scholarMentorRoleCanKnife(world, role),
        })
      : undefined,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: supported,
    label: roleName(roleNameId),
    skillBrief: text("zh-CN", mentor ? "role.night_mentor.brief" : "role.day_scholar.brief"),
    renderPrompt: (_role, locale = "zh-CN") =>
      text(locale, mentor ? "role.night_mentor.brief" : "role.day_scholar.brief"),
    init: (role, ctx) => {
      parameters.parse(ctx.boardConfig?.scholarMentor ?? {});
      role.privateState.scholarMentor = createModifierState(
        mentor ? "night_mentor" : "day_scholar",
      );
    },
    configuration: {
      schema: parameters,
      defaults: parameters.parse({}),
      apply: (config, value) => ({ ...config, scholarMentor: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.scholarMentor ?? {}),
    },
    toolSpecs: [
      ...(base?.toolSpecs ?? []),
      {
        name: "modify_skill",
        parameters: {
          type: "object",
          properties: {
            mode: { type: ["string", "null"], enum: ["enhance", "weaken", null] },
            target_id: { type: ["integer", "null"], minimum: 1 },
          },
          required: ["mode", "target_id"],
          additionalProperties: false,
        },
        argHint: 'modify_skill args: {"mode":"enhance"|"weaken"|null,"target_id":number|null}',
        userPromptHintKey: "action.modify_skill.hint",
      },
      {
        name: "bonus_action",
        parameters: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["check", "guard", "poison", "kill"] },
            target_id: { type: ["integer", "null"], minimum: 1 },
            abstain: { type: "boolean" },
          },
          required: ["kind", "target_id", "abstain"],
          additionalProperties: false,
        },
        argHint:
          'bonus_action args: {"kind":"check"|"guard"|"poison"|"kill","target_id":number|null,"abstain":boolean}',
        userPromptHintKey: "action.bonus_action.hint",
      },
    ],
    stageDirectives: [
      ...(base?.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "modify_skill",
        messageKey: "action.modify_skill.directive",
        text: text("zh-CN", "action.modify_skill.directive"),
      },
      {
        match: (tools) => tools.length === 1 && tools[0] === "bonus_action",
        messageKey: "action.bonus_action.directive",
        text: text("zh-CN", "action.bonus_action.directive"),
      },
    ],
    validationRules: {
      ...base?.validationRules,
      modify_skill: ({ world, role, actorId, day, phase, toolCall }) => {
        const state = scholarMentorStateForRole(role);
        if (
          !state ||
          !isScholarMentorBoard(world) ||
          day === undefined ||
          phase !== Phase.Night ||
          toolCall.name !== "modify_skill" ||
          !scholarMentorChoicePending(world, day, actorId)
        )
          return { code: RuleError.ModifierUnavailable };
        const { mode, target_id } = toolCall.args;
        if (mode === null) return target_id === null ? null : { code: RuleError.ModifierTarget };
        return (mode === "enhance" || mode === "weaken") &&
          state.remaining[mode] === 1 &&
          target_id !== null &&
          scholarMentorChoiceTargets(world, day, actorId).includes(target_id)
          ? null
          : { code: RuleError.ModifierTarget };
      },
      bonus_action: ({ world, actorId, day, phase, toolCall }) => {
        if (
          !isScholarMentorBoard(world) ||
          day === undefined ||
          phase !== Phase.Night ||
          toolCall.name !== "bonus_action"
        )
          return { code: RuleError.ModifierUnavailable };
        const { kind, target_id, abstain } = toolCall.args;
        if (
          !["check", "guard", "poison", "kill"].includes(kind) ||
          typeof abstain !== "boolean" ||
          (abstain ? target_id !== null : target_id === null)
        )
          return { code: RuleError.ModifierTarget };
        try {
          captureScholarMentorBonus(world, day, actorId, kind, target_id);
          return null;
        } catch {
          return { code: RuleError.ModifierTarget };
        }
      },
    },
    nightStages: [...SCHOLAR_MENTOR_NIGHT_STAGES, ...(base?.nightStages ?? [])],
    baselineAction: (role, request, pick, pickCamp, locale, world) => {
      if (request.allowedTools.includes("modify_skill") && world) {
        const state = scholarMentorStateForRole(role),
          targets = scholarMentorChoiceTargets(world, request.context.day, request.actorId);
        const mode =
          state?.remaining.enhance === 1
            ? "enhance"
            : state?.remaining.weaken === 1
              ? "weaken"
              : null;
        const target = targets.find((id) => id !== request.actorId) ?? targets[0] ?? null;
        return {
          name: "modify_skill",
          args: { mode: target === null ? null : mode, target_id: mode === null ? null : target },
        };
      }
      if (
        request.allowedTools.includes("bonus_action") &&
        world &&
        request.context.modifier_bonus_kind
      ) {
        const kind = request.context.modifier_bonus_kind,
          target =
            scholarMentorBonusTargets(world, request.context.day, request.actorId, kind)[0] ?? null;
        return {
          name: "bonus_action",
          args: { kind, target_id: target, abstain: target === null },
        };
      }
      return base?.baselineAction?.(role, request, pick, pickCamp, locale, world) ?? null;
    },
  };
}
export const SCHOLAR_ROLE_PROFILE = profile(Role.DayScholar);
export const MENTOR_ROLE_PROFILE = profile(Role.NightMentor);
