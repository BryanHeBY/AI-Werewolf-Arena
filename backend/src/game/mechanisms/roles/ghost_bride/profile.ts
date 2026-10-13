/**
 * 负责 鬼魂新娘 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { GHOST_BRIDE_POLICY, freshGhostBrideState } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition, COMPONENT } from "../../../../core/domain";
import type { NativeRoleContributions } from "../contracts";
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
export const GHOST_BRIDE_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.GhostBride,
    camp: Camp.ThirdParty,
    maxCount: 1,
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
  },
  runtime: {
    canSelfDestruct: false,
    inspectionLabels: { camp: "good" },
    init: (role) => {
      role.privateState.ghostBride = freshGhostBrideState();
    },
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
  },
  presentation: nativeRolePresentation("ghost_bride"),
};
