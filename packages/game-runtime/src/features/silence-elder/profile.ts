/**
 * 负责禁言长老资料、唯一状态初始化、严格工具和纯值展示贡献。输入为原角色、公开配置及受限查询，
 * 输出为可装配的规则声明；夜窗与表达窗仍由本族 authority 唯一授权，工具接受不等于实际付款。
 * 本角色只开放已核原十二人牌组，额外角色／机制组合由 rulesets 拒绝，不扩中央原生捕获。
 */
import { z } from "zod";
import { Camp, Role, Phase, RuleError, WinCondition } from "@ai-werewolf-arena/game-contract";
import {
  SILENCE_ELDER_POLICY,
  readSilenceElderStateData,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import type { RoleContributions } from "../../rulesets/roles/contracts";
import { ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules } from "../../engine/actions/validation-queries";
import { initializeSilenceElderState } from "./state";
import { silenceChoiceAllowed, silenceExpressionActionAllowed } from "./authority";
import { SILENCE_ELDER_NIGHT_STAGE } from "./night-stage";
import { silenceElderPromptState } from "./presentation";

const parameters = z.strictObject({
  policy: z.literal(SILENCE_ELDER_POLICY).default(SILENCE_ELDER_POLICY),
});
const message = { type: ["string", "null"], minLength: 1, maxLength: 8192 };
const validText = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 8192;
export const SILENCE_ELDER_ROLE_PROFILE: RoleContributions = {
  metadata: {
    role: Role.SilenceElder,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    label: roleName("silence_elder"),
    skillBrief: text("zh-CN", "role.silence_elder.brief"),
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.SilenceElder,
    ],
  },
  runtime: {
    init: ownRoleCallback("init", { init: initializeSilenceElderState }),
    configuration: {
      schema: parameters,
      defaults: { policy: SILENCE_ELDER_POLICY },
      apply: (config, value) => ({ ...config, silenceElder: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.silenceElder ?? {}),
    },
    nightStages: [SILENCE_ELDER_NIGHT_STAGE],
    toolSpecs: [
      {
        name: "silence",
        parameters: {
          type: "object",
          properties: {
            target_id: { type: "integer", minimum: 1 },
            translator_id: { type: ["integer", "null"], minimum: 1 },
          },
          required: ["target_id", "translator_id"],
          additionalProperties: false,
        },
        argHint: 'silence args: {"target_id":number,"translator_id":number|null}',
        userPromptHintKey: "action.silence.hint",
      },
      {
        name: "gesture",
        parameters: {
          type: "object",
          properties: { description: { type: "string", minLength: 1, maxLength: 8192 } },
          required: ["description"],
          additionalProperties: false,
        },
        argHint: 'gesture args: {"description":string}',
        userPromptHintKey: "action.gesture.hint",
      },
      {
        name: "translate_silence",
        parameters: {
          type: "object",
          properties: { text: message },
          required: ["text"],
          additionalProperties: false,
        },
        argHint: 'translate_silence args: {"text":string|null}',
        userPromptHintKey: "action.translate_silence.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "silence",
        messageKey: "action.silence.directive",
        text: text("zh-CN", "action.silence.directive"),
      },
      {
        match: (tools) => tools.length === 1 && tools[0] === "gesture",
        messageKey: "action.gesture.directive",
        text: text("zh-CN", "action.gesture.directive"),
      },
      {
        match: (tools) => tools.length === 1 && tools[0] === "translate_silence",
        messageKey: "action.translate_silence.directive",
        text: text("zh-CN", "action.translate_silence.directive"),
      },
    ],
    validationRules: ownedToolRules({
      silence: ({ world, actorId, phase, day, toolCall }) =>
        phase === Phase.Night &&
        day !== undefined &&
        toolCall.name === "silence" &&
        silenceChoiceAllowed(
          world,
          actorId,
          day,
          toolCall.args.target_id,
          toolCall.args.translator_id,
        )
          ? null
          : { code: RuleError.CustomRuleError },
      gesture: ({ world, actorId, phase, day, toolCall }) =>
        (phase === Phase.Day || phase === Phase.Voting) &&
        day !== undefined &&
        toolCall.name === "gesture" &&
        validText(toolCall.args.description) &&
        silenceExpressionActionAllowed(world, day, actorId, "gesture")
          ? null
          : { code: RuleError.CustomRuleError },
      translate_silence: ({ world, actorId, phase, day, toolCall }) =>
        (phase === Phase.Day || phase === Phase.Voting) &&
        day !== undefined &&
        toolCall.name === "translate_silence" &&
        (toolCall.args.text === null || validText(toolCall.args.text)) &&
        silenceExpressionActionAllowed(world, day, actorId, "translation")
          ? null
          : { code: RuleError.CustomRuleError },
    }),
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (_role, request) =>
        request.allowedTools.includes("silence")
          ? {
              name: "silence",
              args: {
                target_id: request.context.silence_candidates?.[0] ?? request.actorId,
                translator_id: null,
              },
            }
          : null,
    }),
  },
  presentation: {
    kind: "custom",
    renderPrompt: (queries, locale = "zh-CN") => {
      const value = queries.stateData() as { silenceElder?: unknown } | null;
      return silenceElderPromptState(readSilenceElderStateData(value?.silenceElder), locale);
    },
  },
};
