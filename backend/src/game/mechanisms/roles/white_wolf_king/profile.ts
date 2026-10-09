import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Role, ActionWindow, Phase } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { getWhiteWolfKingState, setWhiteWolfKingState } from "../private_state";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";

export const WHITE_WOLF_KING_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.WhiteWolfKing,
  canSelfDestruct: false,
  label: roleName("white_wolf_king"),
  skillBrief: text("zh-CN", "role.white_wolf_king.brief"),
  init: (role) => {
    setWhiteWolfKingState(role, { canDetonate: true });
  },
  renderPrompt: (role, locale = "zh-CN") =>
    text(locale, "role.white_wolf_king.state", {
      remaining: getWhiteWolfKingState(role)?.canDetonate ? 1 : 0,
    }),
  toolSpecs: [
    ...WOLF_ROLE_PROFILE.toolSpecs!.filter((spec) => spec.name !== "self_destruct"),
    {
      name: "self_destruct_with_target",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
          confirm: { type: "boolean" },
          target_id: { type: ["number", "null"] },
        },
        required: ["reason", "confirm", "target_id"],
        additionalProperties: false,
      },
      argHint:
        'self_destruct_with_target args: {"reason":"...","confirm":true,"target_id":number|null}',
      userPromptHintKey: "action.white_wolf_king.hint",
    },
  ],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    self_destruct_with_target: ({
      world,
      actorId,
      role,
      toolCall,
      phase,
      actionWindow,
      allowSelfDestruct,
    }) => {
      if (role.role !== Role.WhiteWolfKing || getWhiteWolfKingState(role)?.canDetonate !== true)
        return { code: RuleError.WhiteWolfBlastUnavailable };
      if (phase !== Phase.Day && phase !== Phase.Voting) return { code: RuleError.BlastPhase };
      if (actionWindow === undefined || !Object.values(ActionWindow).includes(actionWindow))
        return { code: RuleError.BlastWindow };
      if (phase !== (actionWindow === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day))
        return { code: RuleError.BlastPhase };
      if (!allowSelfDestruct) return { code: RuleError.BlastDisabled };
      if (toolCall.name !== "self_destruct_with_target" || toolCall.args.confirm !== true)
        return { code: RuleError.BlastConfirm };
      if (
        toolCall.args.target_id !== null &&
        (!isAliveTarget(world, toolCall.args.target_id) || toolCall.args.target_id === actorId)
      )
        return { code: RuleError.WhiteWolfBlastTarget };
      return null;
    },
  },
  stageDirectives: [
    ...WOLF_ROLE_PROFILE.stageDirectives!,
    {
      match: (tools) => tools.length === 1 && tools[0] === "self_destruct_with_target",
      messageKey: "action.white_wolf_king.directive",
      text: text("zh-CN", "action.white_wolf_king.directive"),
    },
  ],
  llmRepair: {
    coerce: {
      ...WOLF_ROLE_PROFILE.llmRepair?.coerce,
      self_destruct_with_target: (args) => {
        const target = args.target_id === null ? null : numberOrNull(args.target_id);
        return args.target_id !== null && target === null
          ? null
          : {
              reason: String(args.reason ?? ""),
              confirm: Boolean(args.confirm),
              target_id: target,
            };
      },
    },
  },
  baselineAction: (role, request, pickAliveNotSelf, pickAliveByCamp, locale) =>
    request.allowedTools.includes("self_destruct_with_target")
      ? null
      : WOLF_ROLE_PROFILE.baselineAction!(role, request, pickAliveNotSelf, pickAliveByCamp, locale),
};
