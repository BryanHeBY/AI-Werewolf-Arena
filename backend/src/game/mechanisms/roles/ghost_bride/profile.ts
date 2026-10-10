import { z } from "zod";
import {
  GHOST_BRIDE_POLICY,
  freshGhostBrideState,
  roleName,
  text,
} from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition, COMPONENT } from "../../../../core/domain";
import type { RoleProfile } from "../contracts";
import { canSubmitWeddingTool, weddingBrideState } from "./authority";
import type { ToolRule } from "../../validation/contracts";
const parameters = z.strictObject({
  policy: z.literal(GHOST_BRIDE_POLICY).default(GHOST_BRIDE_POLICY),
});
const validate: ToolRule = ({ world, actorId, phase, day, ghostBrideScope, toolCall }) =>
  canSubmitWeddingTool(world, actorId, phase, day ?? 0, ghostBrideScope, toolCall)
    ? null
    : { code: RuleError.GhostBrideUnavailable };
const target = {
  type: "object",
  properties: { target_id: { type: "integer", minimum: 1 } },
  required: ["target_id"],
  additionalProperties: false,
};
export const GHOST_BRIDE_ROLE_PROFILE: RoleProfile = {
  role: Role.GhostBride,
  camp: Camp.ThirdParty,
  maxCount: 1,
  canSelfDestruct: false,
  inspectionLabels: { camp: "good" },
  supportedWinConditions: [WinCondition.ThreeFactionsElimination],
  supportedBoardRoles: [
    Role.GhostBride,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Guard,
    Role.Hunter,
  ],
  label: roleName("ghost_bride"),
  skillBrief: text("zh-CN", "role.ghost_bride.brief"),
  init: (role) => {
    role.privateState.ghostBride = freshGhostBrideState();
  },
  renderPrompt: (_role, locale = "zh-CN", world) =>
    text(locale, "role.ghost_bride.state", {
      state: JSON.stringify(
        world
          ? weddingBrideState(
              world,
              world.entityIds().find((id) => world.getComponent(id, COMPONENT.Role) === _role) ?? 0,
            )
          : undefined,
      ),
    }),
  configuration: {
    schema: parameters,
    defaults: { policy: GHOST_BRIDE_POLICY },
    apply: (config, value) => ({ ...config, ghostBride: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.ghostBride ?? {}),
  },
  toolSpecs: [
    {
      name: "choose_bridegroom",
      parameters: target,
      argHint: 'choose_bridegroom args: {"target_id":number}',
      userPromptHintKey: "action.choose_bridegroom.hint",
    },
    {
      name: "choose_wedding_witness",
      parameters: target,
      argHint: 'choose_wedding_witness args: {"target_id":number}',
      userPromptHintKey: "action.choose_wedding_witness.hint",
    },
    {
      name: "speak_to_partner",
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false,
      },
      argHint: 'speak_to_partner args: {"text":string}',
      userPromptHintKey: "action.speak_to_partner.hint",
    },
    {
      name: "wedding_kill_vote",
      parameters: {
        type: "object",
        properties: { target_id: { type: ["integer", "null"] }, abstain: { type: "boolean" } },
        required: ["target_id", "abstain"],
        additionalProperties: false,
      },
      argHint: 'wedding_kill_vote args: {"target_id":number|null,"abstain":boolean}',
      userPromptHintKey: "action.wedding_kill_vote.hint",
    },
  ],
  validationRules: {
    choose_bridegroom: validate,
    choose_wedding_witness: validate,
    speak_to_partner: validate,
    wedding_kill_vote: validate,
  },
};
