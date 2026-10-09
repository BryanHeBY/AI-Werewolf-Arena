import { z } from "zod";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Camp, Role, WinCondition } from "../../../../core/domain";
import type { RoleProfile } from "../contracts";
import {
  SHAPESHIFTER_POLICY,
  getShapeshifterState,
  projectShapeshifterState,
  readShapeshifterChoice,
} from "./state";
import { authorizedShapeshifterScope } from "./setup";
const parameters = z.strictObject({
  policy: z.literal(SHAPESHIFTER_POLICY).default(SHAPESHIFTER_POLICY),
});
export const SHAPESHIFTER_ROLE_PROFILE: RoleProfile = {
  role: Role.Shapeshifter,
  camp: Camp.Good,
  goodSide: "villager",
  maxCount: 1,
  label: roleName("shapeshifter"),
  skillBrief: text("zh-CN", "role.shapeshifter.brief"),
  supportedWinConditions: [WinCondition.SlaughterCity],
  supportedBoardRoles: [
    Role.Shapeshifter,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Idiot,
  ],
  init: (role, ctx) => {
    if (!getShapeshifterState(role))
      role.privateState.shapeshifter = {
        policy: ctx.boardConfig?.shapeshifter?.policy ?? SHAPESHIFTER_POLICY,
        remaining: 1,
        choice: null,
      };
  },
  renderPrompt: (role, locale = "zh-CN", world) =>
    text(locale, "role.shapeshifter.state", {
      state: JSON.stringify(world ? projectShapeshifterState(role, world) : undefined),
    }),
  configuration: {
    schema: parameters,
    defaults: { policy: SHAPESHIFTER_POLICY },
    apply: (config, value) => ({ ...config, shapeshifter: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.shapeshifter ?? {}),
  },
  toolSpecs: [
    {
      name: "choose_shapeshifter_card",
      parameters: {
        type: "object",
        properties: { slot: { type: "integer", enum: [0, 1] } },
        required: ["slot"],
        additionalProperties: false,
      },
      argHint: 'choose_shapeshifter_card args: {"slot":0|1}',
      userPromptHintKey: "action.choose_shapeshifter_card.hint",
    },
  ],
  validationRules: {
    choose_shapeshifter_card: ({ world, actorId, day, phase, toolCall, shapeshifterScope }) => {
      const scope = authorizedShapeshifterScope(world, actorId, day, phase, shapeshifterScope);
      if (!scope) return { code: RuleError.ShapeshifterUnavailable };
      return toolCall.name === "choose_shapeshifter_card" &&
        scope.allowedSlots.includes(readShapeshifterChoice(toolCall.args) as 0 | 1)
        ? null
        : { code: RuleError.ShapeshifterChoice };
    },
  },
  baselineAction: () => null,
};
