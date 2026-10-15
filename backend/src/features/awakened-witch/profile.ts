/**
 * 负责觉醒女巫有限原十二人板的角色贡献。输入为原角色、严格空参数与受限展示查询，
 * 输出本族历史初始化、工具/阶段/校验及纯值展示；工具登记不授予协助者行动权。
 * 唯一历史槽拥有次数与资格，不复用普通女巫瓶数或中央原生角色捕获分派。
 */
import { z } from "zod";
import { Role, Camp, Phase, RuleError, WinCondition } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_WITCH_POLICY,
  readAwakenedWitchStateData,
} from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import type { RoleContributions } from "../../rulesets/roles/contracts";
import { ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules } from "../../engine/actions/validation-queries";
import { initializeAwakenedWitchState } from "./state";
import {
  awakenedBrewAllowed,
  awakenedBrewDiscussionCurrent,
  awakenedBrewApprovalCurrent,
} from "./authority";
import { AWAKENED_WITCH_NIGHT_STAGE } from "./night-stage";
import { awakenedWitchPromptState } from "./presentation";
import { awakenedWitchBaseline } from "./baseline";
const parameters = z.strictObject({});
export const AWAKENED_WITCH_ROLE_PROFILE: RoleContributions = {
  metadata: {
    role: Role.AwakenedWitch,
    camp: Camp.Good,
    goodSide: "god",
    label: roleName("awakened_witch"),
    skillBrief: text("zh-CN", "role.awakened_witch.brief"),
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.Wolf,
      Role.AwakenedWolfKing,
      Role.Villager,
      Role.Seer,
      Role.Guard,
      Role.Hunter,
      Role.AwakenedWitch,
    ],
  },
  runtime: {
    init: ownRoleCallback("init", { init: initializeAwakenedWitchState }),
    configuration: {
      schema: parameters,
      defaults: {},
      apply: (c, v) => {
        parameters.parse(v);
        return { ...c, awakenedWitch: { policy: AWAKENED_WITCH_POLICY } };
      },
      serialize: () => ({}),
    },
    nightStages: [AWAKENED_WITCH_NIGHT_STAGE],
    toolSpecs: [
      {
        name: "awakened_brew",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["heal", "poison", "pass"] },
            target_id: { type: ["integer", "null"], minimum: 1 },
            assistant_ids: {
              type: "array",
              items: { type: "integer", minimum: 1 },
              minItems: 0,
              maxItems: 3,
              uniqueItems: true,
            },
          },
          required: ["mode", "target_id", "assistant_ids"],
          additionalProperties: false,
        },
        argHint:
          'awakened_brew args: {"mode":"heal"|"poison"|"pass","target_id":number|null,"assistant_ids":number[]}',
        userPromptHintKey: "action.awakened_brew.hint",
      },
      {
        name: "brew_discuss",
        parameters: {
          type: "object",
          properties: { text: { type: "string", maxLength: 8192 } },
          required: ["text"],
          additionalProperties: false,
        },
        argHint: 'brew_discuss args: {"text":string}',
        userPromptHintKey: "action.brew_discuss.hint",
      },
      {
        name: "brew_approve",
        parameters: {
          type: "object",
          properties: { approve: { type: "boolean" } },
          required: ["approve"],
          additionalProperties: false,
        },
        argHint: 'brew_approve args: {"approve":boolean}',
        userPromptHintKey: "action.brew_approve.hint",
      },
    ],
    stageDirectives: ["awakened_brew", "brew_discuss", "brew_approve"].map((tool) => ({
      match: (tools) => tools.length === 1 && tools[0] === tool,
      messageKey: `action.${tool}.directive` as
        | "action.awakened_brew.directive"
        | "action.brew_discuss.directive"
        | "action.brew_approve.directive",
      text: text(
        "zh-CN",
        `action.${tool}.directive` as
          | "action.awakened_brew.directive"
          | "action.brew_discuss.directive"
          | "action.brew_approve.directive",
      ),
    })),
    validationRules: ownedToolRules({
      awakened_brew: ({ world, actorId, day, phase, toolCall }) =>
        phase === Phase.Night &&
        day !== undefined &&
        toolCall.name === "awakened_brew" &&
        awakenedBrewAllowed(world, actorId, day, {
          mode: toolCall.args.mode,
          targetId: toolCall.args.target_id,
          assistantIds: toolCall.args.assistant_ids,
        })
          ? null
          : { code: RuleError.CustomRuleError },
      brew_discuss: ({ world, actorId, day, phase, toolCall }) =>
        phase === Phase.Night &&
        day !== undefined &&
        toolCall.name === "brew_discuss" &&
        typeof toolCall.args.text === "string" &&
        toolCall.args.text.length <= 8192 &&
        awakenedBrewDiscussionCurrent(world, actorId, day)
          ? null
          : { code: RuleError.CustomRuleError },
      brew_approve: ({ world, actorId, day, phase, toolCall }) =>
        phase === Phase.Night &&
        day !== undefined &&
        toolCall.name === "brew_approve" &&
        typeof toolCall.args.approve === "boolean" &&
        awakenedBrewApprovalCurrent(world, actorId, day)
          ? null
          : { code: RuleError.CustomRuleError },
    }),
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (_role, request, _pick, _camp, locale) =>
        awakenedWitchBaseline(request, locale ?? "zh-CN") ?? null,
    }),
  },
  presentation: {
    kind: "custom",
    renderPrompt: (q, locale = "zh-CN") =>
      awakenedWitchPromptState(
        readAwakenedWitchStateData(
          (q.stateData() as { awakenedWitch?: unknown } | null)?.awakenedWitch,
        ),
        locale,
      ),
  },
};
