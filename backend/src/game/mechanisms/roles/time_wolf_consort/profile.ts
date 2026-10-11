import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition, Phase } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { TIME_CONSORT_POLICY, createTimeConsortState, getTimeConsortState } from "./state";
import { timeConsortChoicePending, timeConsortChoiceTargets } from "./night_frame";
import { TIME_CONSORT_LOCK_STAGE } from "./night_stages";
const parameters = z.strictObject({
  policy: z.literal(TIME_CONSORT_POLICY).default(TIME_CONSORT_POLICY),
  reflectionScope: z.enum(["whole_night", "first_effect"]).default("whole_night"),
});
export const TIME_CONSORT_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.TimeWolfConsort,
  camp: Camp.Wolf,
  maxCount: 1,
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Guard,
    Role.OrderPrince,
    Role.TimeWolfConsort,
  ],
  label: roleName("time_wolf_consort"),
  skillBrief: text("zh-CN", "role.time_wolf_consort.brief"),
  init: (role, ctx) => {
    const value = parameters.parse(ctx.boardConfig?.timeConsort ?? {});
    role.privateState.timeConsort = createTimeConsortState(value.reflectionScope);
  },
  renderPrompt: (role, locale = "zh-CN") =>
    text(locale, "role.time_wolf_consort.brief") +
    " " +
    text(
      locale,
      getTimeConsortState(role)?.reflectionScope === "first_effect"
        ? "role.time_wolf_consort.scope_first_effect"
        : "role.time_wolf_consort.scope_whole_night",
    ),
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, timeConsort: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.timeConsort ?? {}),
  },
  toolSpecs: [
    ...(WOLF_ROLE_PROFILE.toolSpecs ?? []),
    {
      name: "lock_time",
      parameters: {
        type: "object",
        properties: {
          target_id: { type: ["integer", "null"], minimum: 1 },
          abstain: { type: "boolean" },
        },
        required: ["target_id", "abstain"],
        additionalProperties: false,
      },
      argHint: 'lock_time args: {"target_id":number|null,"abstain":true|false}',
      userPromptHintKey: "action.lock_time.hint",
    },
  ],
  stageDirectives: [
    ...(WOLF_ROLE_PROFILE.stageDirectives ?? []),
    {
      match: (tools) => tools.length === 1 && tools[0] === "lock_time",
      messageKey: "action.lock_time.directive",
      text: text("zh-CN", "action.lock_time.directive"),
    },
  ],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    lock_time: ({ world, role, actorId, day, phase, toolCall }) => {
      if (
        !getTimeConsortState(role) ||
        day === undefined ||
        phase !== Phase.Night ||
        toolCall.name !== "lock_time" ||
        !timeConsortChoicePending(world, actorId, day)
      )
        return { code: RuleError.TimeConsortUnavailable };
      const { target_id, abstain } = toolCall.args;
      if (abstain) return target_id === null ? null : { code: RuleError.TimeConsortTarget };
      return target_id !== null && timeConsortChoiceTargets(world, day).includes(target_id)
        ? null
        : { code: RuleError.TimeConsortTarget };
    },
  },
  nightStages: [TIME_CONSORT_LOCK_STAGE, ...(WOLF_ROLE_PROFILE.nightStages ?? [])],
  baselineAction: (role, request, pick, pickCamp, locale, world) => {
    if (!request.allowedTools.includes("lock_time") || !world || !getTimeConsortState(role))
      return (
        WOLF_ROLE_PROFILE.baselineAction?.(role, request, pick, pickCamp, locale, world) ?? null
      );
    const targets = timeConsortChoiceTargets(world, request.context.day);
    return targets.length >= 1
      ? {
          name: "lock_time",
          args: { target_id: targets[0]!, abstain: false },
        }
      : { name: "lock_time", args: { target_id: null, abstain: true } };
  },
};
