import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition, Phase } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { ORDER_PRINCE_POLICY, createOrderPrinceState, getOrderPrinceState } from "./state";
import { orderPrinceChoicePending } from "./authority";
const parameters = z.strictObject({
  policy: z.literal(ORDER_PRINCE_POLICY).default(ORDER_PRINCE_POLICY),
});
export const ORDER_PRINCE_ROLE_PROFILE: RoleProfile = {
  role: Role.OrderPrince,
  camp: Camp.Good,
  goodSide: "god",
  maxCount: 1,
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.Trickster,
    Role.Magician,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.OrderPrince,
  ],
  label: roleName("order_prince"),
  skillBrief: text("zh-CN", "role.order_prince.brief"),
  init: (role) => {
    role.privateState.orderPrince = createOrderPrinceState();
  },
  renderPrompt: (_role, locale = "zh-CN") => text(locale, "role.order_prince.brief"),
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, orderPrince: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.orderPrince ?? {}),
  },
  toolSpecs: [
    {
      name: "reset_exile_vote",
      parameters: {
        type: "object",
        properties: { activate: { type: "boolean" } },
        required: ["activate"],
        additionalProperties: false,
      },
      argHint: 'reset_exile_vote args: {"activate":true|false}',
      userPromptHintKey: "action.reset_exile_vote.hint",
    },
  ],
  stageDirectives: [
    {
      match: (tools) => tools.length === 1 && tools[0] === "reset_exile_vote",
      messageKey: "action.reset_exile_vote.directive",
      text: text("zh-CN", "action.reset_exile_vote.directive"),
    },
  ],
  validationRules: {
    reset_exile_vote: ({ world, role, actorId, day, phase, toolCall }) => {
      if (
        !getOrderPrinceState(role) ||
        day === undefined ||
        phase !== Phase.Voting ||
        toolCall.name !== "reset_exile_vote" ||
        !orderPrinceChoicePending(world, actorId, day)
      )
        return { code: RuleError.OrderPrinceUnavailable };
      return null;
    },
  },
  baselineAction: (role, request) =>
    request.allowedTools.includes("reset_exile_vote") && getOrderPrinceState(role)
      ? { name: "reset_exile_vote", args: { activate: true } }
      : null,
};
