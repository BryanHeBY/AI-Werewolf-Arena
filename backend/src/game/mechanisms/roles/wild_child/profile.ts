import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Camp, Role, WinCondition } from "../../../../core/domain";
import type { RoleProfile } from "../contracts";
import { WOLF_NIGHT_STAGES } from "../wolf/night_stages";
import { WOLF_TOOL_SPECS, WOLF_STAGE_DIRECTIVES } from "../wolf/tool_specs";
import { WOLF_VALIDATION_RULES } from "../wolf/validation_rules";
import { WOLF_LLM_REPAIR_PACK } from "../wolf/llm_repair";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import {
  WILD_CHILD_POLICY,
  freshWildChildState,
  getWildChildState,
  readWildChildTool,
} from "./state";
import {
  authorizedWildChild,
  projectWildChild,
  wildChildPackActive,
  wildChildPackKnown,
} from "./lifecycle";
const parameters = z.strictObject({
  policy: z.literal(WILD_CHILD_POLICY).default(WILD_CHILD_POLICY),
});
export const WILD_CHILD_ROLE_PROFILE: RoleProfile = {
  role: Role.WildChild,
  camp: Camp.Good,
  goodSide: "villager",
  maxCount: 1,
  canSelfDestruct: false,
  supportedWinConditions: [WinCondition.SlaughterCity],
  supportedBoardRoles: [
    Role.WildChild,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Idiot,
  ],
  label: roleName("wild_child"),
  skillBrief: text("zh-CN", "role.wild_child.brief"),
  init: (role) => {
    if (!getWildChildState(role)) role.privateState.wildChild = freshWildChildState();
  },
  renderPrompt: (role, locale = "zh-CN", world) =>
    text(locale, "role.wild_child.state", {
      camp: role.camp,
      state: JSON.stringify(world ? projectWildChild(world, role) : undefined),
    }),
  configuration: {
    schema: parameters,
    defaults: { policy: WILD_CHILD_POLICY },
    apply: (config, value) => ({ ...config, wildChild: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.wildChild ?? {}),
  },
  wolfTeam: (role, world) => ({
    recognizedByPack: wildChildPackKnown(role, world),
    recognizes: wildChildPackKnown(role, world) ? "pack" : "none",
    canChat: wildChildPackActive(role, world),
    canVoteForKill: wildChildPackActive(role, world),
  }),
  nightStages: WOLF_NIGHT_STAGES,
  stageDirectives: WOLF_STAGE_DIRECTIVES,
  toolSpecs: [
    ...WOLF_TOOL_SPECS.filter((spec) => spec.name !== "self_destruct"),
    {
      name: "choose_wild_model",
      parameters: {
        type: "object",
        properties: { target_id: { type: "integer" } },
        required: ["target_id"],
        additionalProperties: false,
      },
      argHint: 'choose_wild_model args: {"target_id":number}',
      userPromptHintKey: "action.choose_wild_model.hint",
    },
  ],
  validationRules: {
    ...WOLF_VALIDATION_RULES,
    choose_wild_model: ({ world, actorId, day, phase, toolCall, wildChildScope }) =>
      !authorizedWildChild(world, actorId, day, phase, wildChildScope)
        ? { code: RuleError.WildChildUnavailable }
        : readWildChildTool(toolCall) &&
            toolCall.name === "choose_wild_model" &&
            toolCall.args.target_id !== actorId &&
            world.getAliveEntityIds().includes(toolCall.args.target_id)
          ? null
          : { code: RuleError.WildChildChoice },
  },
  llmRepair: WOLF_LLM_REPAIR_PACK,
  baselineAction: (role, request, pickAliveNotSelf, pickAliveByCamp, locale, world) =>
    request.allowedTools.includes("choose_wild_model")
      ? { name: "choose_wild_model", args: { target_id: pickAliveNotSelf()! } }
      : (WOLF_ROLE_PROFILE.baselineAction?.(
          role,
          request,
          pickAliveNotSelf,
          pickAliveByCamp,
          locale,
          world,
        ) ?? null),
};
