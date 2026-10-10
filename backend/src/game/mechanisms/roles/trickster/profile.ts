import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition, Phase } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { TRICKSTER_POLICY, createTricksterState, getTricksterState } from "./state";
import {
  tricksterChoicePending,
  tricksterChoiceTargets,
  tricksterMayPass,
  tricksterPackReady,
} from "./night_frame";
import { TRICKSTER_EXCHANGE_STAGE } from "./night_stages";
const parameters = z.strictObject({
  policy: z.literal(TRICKSTER_POLICY).default(TRICKSTER_POLICY),
});
export const TRICKSTER_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.Trickster,
  camp: Camp.Wolf,
  wolfTeam: (role, world) => {
    const ready =
      !!getTricksterState(role)?.history.length && (!world || tricksterPackReady(world));
    return {
      recognizedByPack: ready,
      recognizes: ready ? "pack" : "none",
      canChat: ready,
      canVoteForKill: ready,
    };
  },
  maxCount: 1,
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Magician,
    Role.OrderPrince,
    Role.Trickster,
  ],
  label: roleName("trickster"),
  skillBrief: text("zh-CN", "role.trickster.brief"),
  init: (role) => {
    role.privateState.trickster = createTricksterState();
  },
  renderPrompt: (_role, locale = "zh-CN") => text(locale, "role.trickster.brief"),
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, trickster: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.trickster ?? {}),
  },
  toolSpecs: [
    ...(WOLF_ROLE_PROFILE.toolSpecs ?? []),
    {
      name: "swap_exile_targets",
      parameters: {
        type: "object",
        properties: {
          first_id: { type: ["integer", "null"], minimum: 1 },
          second_id: { type: ["integer", "null"], minimum: 1 },
          abstain: { type: "boolean" },
        },
        required: ["first_id", "second_id", "abstain"],
        additionalProperties: false,
      },
      argHint:
        'swap_exile_targets args: {"first_id":number|null,"second_id":number|null,"abstain":true|false}',
      userPromptHintKey: "action.swap_exile_targets.hint",
    },
  ],
  stageDirectives: [
    ...(WOLF_ROLE_PROFILE.stageDirectives ?? []),
    {
      match: (tools) => tools.length === 1 && tools[0] === "swap_exile_targets",
      messageKey: "action.swap_exile_targets.directive",
      text: text("zh-CN", "action.swap_exile_targets.directive"),
    },
  ],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    swap_exile_targets: ({ world, role, actorId, day, phase, toolCall }) => {
      if (
        !getTricksterState(role) ||
        day === undefined ||
        phase !== Phase.Night ||
        toolCall.name !== "swap_exile_targets" ||
        !tricksterChoicePending(world, actorId, day)
      )
        return { code: RuleError.TricksterUnavailable };
      const { first_id, second_id, abstain } = toolCall.args;
      if (abstain)
        return first_id === null && second_id === null && tricksterMayPass(world, day)
          ? null
          : { code: RuleError.TricksterTarget };
      const targets = tricksterChoiceTargets(world, day);
      return first_id !== null &&
        second_id !== null &&
        first_id !== second_id &&
        targets.includes(first_id) &&
        targets.includes(second_id)
        ? null
        : { code: RuleError.TricksterTarget };
    },
  },
  nightStages: [TRICKSTER_EXCHANGE_STAGE, ...(WOLF_ROLE_PROFILE.nightStages ?? [])],
  baselineAction: (role, request, pick, pickCamp, locale, world) => {
    if (!request.allowedTools.includes("swap_exile_targets") || !world || !getTricksterState(role))
      return (
        WOLF_ROLE_PROFILE.baselineAction?.(role, request, pick, pickCamp, locale, world) ?? null
      );
    const targets = tricksterChoiceTargets(world, request.context.day);
    return targets.length >= 2
      ? {
          name: "swap_exile_targets",
          args: { first_id: targets[0]!, second_id: targets[1]!, abstain: false },
        }
      : { name: "swap_exile_targets", args: { first_id: null, second_id: null, abstain: true } };
  },
};
