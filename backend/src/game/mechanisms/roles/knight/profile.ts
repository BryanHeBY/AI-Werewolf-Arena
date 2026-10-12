/**
 * Assembles knight duel state, tool validation and the role's daytime action contributions.
 * Inputs are role initialization/configuration and existing runtime contexts; output is
 * a RoleProfile contribution. Native state access delegates to its owning feature leaf.
 * Existing validation, lifecycle and effect ordering remain their specific contributions;
 * This module does not own archive encoding or create a second state store.
 */
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Role, Camp, Phase, KnightDuelWindow } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getKnightState, setKnightState } from "./state";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";

export const KNIGHT_ROLE_PROFILE: RoleProfile = {
  role: Role.Knight,
  camp: Camp.Good,
  goodSide: "god",
  label: roleName("knight"),
  skillBrief: text("zh-CN", "role.knight.brief"),
  init: (role) => {
    setKnightState(role, { canDuel: true });
  },
  renderPrompt: (role, locale = "zh-CN") =>
    text(locale, "role.knight.state", { remaining: getKnightState(role)?.canDuel ? 1 : 0 }),
  configuration: {
    schema: z.strictObject({
      enabledWindows: z
        .array(z.enum(KnightDuelWindow))
        .refine((windows) => new Set(windows).size === windows.length)
        .default([KnightDuelWindow.AfterSpeeches]),
    }),
    defaults: { enabledWindows: [KnightDuelWindow.AfterSpeeches] },
    apply: (config, value) => ({
      ...config,
      knight: value as { enabledWindows: KnightDuelWindow[] },
    }),
    serialize: (config) => ({
      enabledWindows: [...(config.knight?.enabledWindows ?? [KnightDuelWindow.AfterSpeeches])],
    }),
  },
  toolSpecs: [
    {
      name: "duel",
      parameters: {
        type: "object",
        properties: { target_id: { type: "number" }, confirm: { type: "boolean" } },
        required: ["target_id", "confirm"],
        additionalProperties: false,
      },
      argHint: 'duel args: {"target_id":number,"confirm":true}',
      userPromptHintKey: "action.knight.hint",
    },
  ],
  validationRules: {
    duel: ({ world, actorId, role, toolCall, phase, duelWindow, allowKnightDuel }) => {
      if (role.role !== Role.Knight || getKnightState(role)?.canDuel !== true)
        return { code: RuleError.KnightDuelUnavailable };
      if (
        phase !== Phase.Day ||
        !allowKnightDuel ||
        duelWindow === undefined ||
        !Object.values(KnightDuelWindow).includes(duelWindow)
      )
        return { code: RuleError.KnightDuelWindow };
      if (toolCall.name !== "duel" || toolCall.args.confirm !== true)
        return { code: RuleError.KnightDuelConfirm };
      if (toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id))
        return { code: RuleError.KnightDuelTarget };
      return null;
    },
  },
  stageDirectives: [
    {
      match: (tools) => tools.length === 1 && tools[0] === "duel",
      messageKey: "action.knight.directive",
      text: text("zh-CN", "action.knight.directive"),
    },
  ],
  llmRepair: {
    coerce: {
      duel: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target, confirm: Boolean(args.confirm) };
      },
    },
  },
  baselineAction: () => null,
};
