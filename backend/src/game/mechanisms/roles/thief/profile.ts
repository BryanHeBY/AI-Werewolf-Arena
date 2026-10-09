import { z } from "zod";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Camp, Role, WinCondition } from "../../../../core/domain";
import type { RoleProfile } from "../contracts";
import { THIEF_POLICY, getThiefState, projectThiefState, readThiefChoice } from "./state";
import { authorizedThiefScope } from "./setup";
const parameters = z.strictObject({ policy: z.literal(THIEF_POLICY).default(THIEF_POLICY) });
export const THIEF_ROLE_PROFILE: RoleProfile = {
  role: Role.Thief,
  camp: Camp.Good,
  goodSide: "villager",
  maxCount: 1,
  label: roleName("thief"),
  skillBrief: text("zh-CN", "role.thief.brief"),
  supportedWinConditions: [WinCondition.SlaughterCity],
  supportedBoardRoles: [
    Role.Thief,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Idiot,
  ],
  init: (role, ctx) => {
    if (!getThiefState(role))
      role.privateState.thief = {
        policy: ctx.boardConfig?.thief?.policy ?? THIEF_POLICY,
        remaining: 1,
        choice: null,
      };
  },
  renderPrompt: (role, locale = "zh-CN", world) =>
    text(locale, "role.thief.state", {
      state: JSON.stringify(world ? projectThiefState(role, world) : undefined),
    }),
  configuration: {
    schema: parameters,
    defaults: { policy: THIEF_POLICY },
    apply: (config, value) => ({ ...config, thief: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.thief ?? {}),
  },
  toolSpecs: [
    {
      name: "choose_thief_card",
      parameters: {
        type: "object",
        properties: { slot: { type: "integer", enum: [0, 1] } },
        required: ["slot"],
        additionalProperties: false,
      },
      argHint: 'choose_thief_card args: {"slot":0|1}',
      userPromptHintKey: "action.choose_thief_card.hint",
    },
  ],
  validationRules: {
    choose_thief_card: ({ world, actorId, day, phase, toolCall, thiefScope }) => {
      if (!authorizedThiefScope(world, actorId, day, phase, thiefScope))
        return { code: RuleError.ThiefUnavailable };
      return toolCall.name === "choose_thief_card" && readThiefChoice(toolCall.args) !== undefined
        ? null
        : { code: RuleError.ThiefChoice };
    },
  },
  baselineAction: (_role, request) =>
    request.allowedTools.includes("choose_thief_card")
      ? { name: "choose_thief_card", args: { slot: 0 } }
      : null,
};
