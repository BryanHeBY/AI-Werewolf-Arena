import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Phase, Role, WinCondition } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { createNobleState, createSecretBodyState, readNobleState } from "./state";
import { canSubmitNobleBodyChoice } from "./requests";
import { NOBLE_CHOICE_STAGE, SECRET_BODY_STAGE } from "./night_stages";
const noble = z.strictObject({
  wolfActionPolicy: z.enum(["standard", "no_blast_no_self_knife"]).default("standard"),
});
const body = z.strictObject({
  protectionRepeatPolicy: z
    .enum(["awa_nonconsecutive_nights_v1", "awa_repeat_v1"])
    .default("awa_nonconsecutive_nights_v1"),
});
const common = {
  maxCount: 1,
  supportedBoardRoles: [
    Role.NightNoble,
    Role.AwakenedIdiot,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.DemonHunter,
  ],
  supportedWinConditions: [WinCondition.SlaughterSide],
};
const parameters = {
  type: "object",
  properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
  required: ["target_id"],
  additionalProperties: false,
};
export const NIGHT_NOBLE_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  ...common,
  role: Role.NightNoble,
  camp: Camp.Wolf,
  label: roleName("night_noble"),
  skillBrief: text("zh-CN", "role.night_noble.brief"),
  init: (role, ctx) => {
    role.privateState.noble = createNobleState(
      noble.parse(ctx.boardConfig?.nightNoble ?? {}).wolfActionPolicy,
    );
  },
  renderPrompt: (_role, locale = "zh-CN") => text(locale, "role.night_noble.brief"),
  canSelfDestruct: (role) =>
    readNobleState(role.privateState.noble)?.wolfActionPolicy === "standard",
  configuration: {
    schema: noble,
    defaults: noble.parse({}),
    apply: (config, value) => ({
      ...config,
      nobleSecretBody: { policy: "awa_noble_secret_body_v1" },
      nightNoble: noble.parse(value),
    }),
    serialize: (config) => noble.parse(config.nightNoble ?? {}),
  },
  toolSpecs: [
    ...(WOLF_ROLE_PROFILE.toolSpecs ?? []),
    {
      name: "choose_servant",
      parameters,
      argHint: 'choose_servant args: {"target_id":number|null}',
      userPromptHintKey: "action.choose_servant.hint",
    },
  ],
  stageDirectives: [
    ...(WOLF_ROLE_PROFILE.stageDirectives ?? []),
    {
      match: (tools) => tools.length === 1 && tools[0] === "choose_servant",
      messageKey: "action.choose_servant.directive",
      text: text("zh-CN", "action.choose_servant.directive"),
    },
  ],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    choose_servant: ({ world, actorId, phase, day, nobleBodyScope, toolCall }) =>
      canSubmitNobleBodyChoice(world, actorId, phase, day ?? 0, nobleBodyScope, toolCall)
        ? null
        : { code: RuleError.NobleBodyUnavailable },
  },
  nightStages: [...(WOLF_ROLE_PROFILE.nightStages ?? []), NOBLE_CHOICE_STAGE],
  baselineAction: (role, request, ...rest) =>
    request.allowedTools.includes("choose_servant")
      ? { name: "choose_servant", args: { target_id: null } }
      : (WOLF_ROLE_PROFILE.baselineAction?.(role, request, ...rest) ?? null),
};
export const AWAKENED_IDIOT_ROLE_PROFILE: RoleProfile = {
  ...common,
  role: Role.AwakenedIdiot,
  camp: Camp.Good,
  goodSide: "god",
  canSelfDestruct: false,
  label: roleName("awakened_idiot"),
  skillBrief: text("zh-CN", "role.awakened_idiot.brief"),
  init: (role, ctx) => {
    role.privateState.secretBody = createSecretBodyState(
      body.parse(ctx.boardConfig?.awakenedIdiot ?? {}).protectionRepeatPolicy,
    );
  },
  renderPrompt: (_role, locale = "zh-CN") => text(locale, "role.awakened_idiot.brief"),
  configuration: {
    schema: body,
    defaults: body.parse({}),
    apply: (config, value) => ({
      ...config,
      nobleSecretBody: { policy: "awa_noble_secret_body_v1" },
      awakenedIdiot: body.parse(value),
    }),
    serialize: (config) => body.parse(config.awakenedIdiot ?? {}),
  },
  toolSpecs: [
    {
      name: "protect_secret_body",
      parameters,
      argHint: 'protect_secret_body args: {"target_id":number|null}',
      userPromptHintKey: "action.protect_secret_body.hint",
    },
  ],
  stageDirectives: [
    {
      match: (tools) => tools.length === 1 && tools[0] === "protect_secret_body",
      messageKey: "action.protect_secret_body.directive",
      text: text("zh-CN", "action.protect_secret_body.directive"),
    },
  ],
  validationRules: {
    protect_secret_body: ({ world, actorId, phase, day, nobleBodyScope, toolCall }) =>
      canSubmitNobleBodyChoice(world, actorId, phase, day ?? 0, nobleBodyScope, toolCall)
        ? null
        : { code: RuleError.NobleBodyUnavailable },
  },
  nightStages: [SECRET_BODY_STAGE],
  baselineAction: (_role, request) =>
    request.allowedTools.includes("protect_secret_body")
      ? { name: "protect_secret_body", args: { target_id: null } }
      : null,
};
