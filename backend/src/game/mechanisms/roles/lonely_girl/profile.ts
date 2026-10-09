import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition } from "../../../../core/domain";
import type { RoleProfile } from "../contracts";
import {
  LONELY_GIRL_POLICY,
  freshLonelyGirlState,
  getLonelyGirlState,
  readLonelyGirlTool,
} from "./state";
import { authorizedLonelyGirl, projectLonelyGirl } from "./lifecycle";
const parameters = z.strictObject({
  policy: z.literal(LONELY_GIRL_POLICY).default(LONELY_GIRL_POLICY),
});
export const LONELY_GIRL_ROLE_PROFILE: RoleProfile = {
  role: Role.LonelyGirl,
  camp: Camp.Good,
  goodSide: "villager",
  maxCount: 1,
  initialVictoryAffiliations: [],
  canSelfDestruct: false,
  supportedWinConditions: [WinCondition.SlaughterCity],
  supportedBoardRoles: [
    Role.LonelyGirl,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Idiot,
  ],
  label: roleName("lonely_girl"),
  skillBrief: text("zh-CN", "role.lonely_girl.brief"),
  init: (role) => {
    if (!getLonelyGirlState(role)) role.privateState.lonelyGirl = freshLonelyGirlState();
  },
  renderPrompt: (role, locale = "zh-CN", world) =>
    text(locale, "role.lonely_girl.state", {
      state: JSON.stringify(world ? projectLonelyGirl(world, role) : undefined),
    }),
  configuration: {
    schema: parameters,
    defaults: { policy: LONELY_GIRL_POLICY },
    apply: (config, value) => ({ ...config, lonelyGirl: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.lonelyGirl ?? {}),
  },
  toolSpecs: [
    {
      name: "choose_admired_player",
      parameters: {
        type: "object",
        properties: { target_id: { type: "integer" } },
        required: ["target_id"],
        additionalProperties: false,
      },
      argHint: 'choose_admired_player args: {"target_id":number}',
      userPromptHintKey: "action.choose_admired_player.hint",
    },
  ],
  validationRules: {
    choose_admired_player: ({ world, actorId, day, phase, toolCall, lonelyGirlScope }) =>
      !authorizedLonelyGirl(world, actorId, day, phase, lonelyGirlScope)
        ? { code: RuleError.LonelyGirlUnavailable }
        : readLonelyGirlTool(toolCall) &&
            toolCall.name === "choose_admired_player" &&
            toolCall.args.target_id !== actorId &&
            world.getAliveEntityIds().includes(toolCall.args.target_id)
          ? null
          : { code: RuleError.LonelyGirlChoice },
  },
  baselineAction: (_role, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("choose_admired_player")) return null;
    const target = pickAliveNotSelf();
    return target === null || target === undefined
      ? null
      : { name: "choose_admired_player", args: { target_id: target } };
  },
};
