/**
 * 负责 白狼王 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Role, ActionWindow, Phase } from "../../../../domain/model";
import type { NativeRoleContributions } from "../contracts";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { getWhiteWolfKingState, initializeWhiteWolfKingState } from "./state";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";

export const WHITE_WOLF_KING_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.WhiteWolfKing,
    label: roleName("white_wolf_king"),
    skillBrief: text("zh-CN", "role.white_wolf_king.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    canSelfDestruct: false,
    init: initializeWhiteWolfKingState,
    toolSpecs: [
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs!.filter((spec) => spec.name !== "self_destruct"),
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
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
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
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives!,
      {
        match: (tools) => tools.length === 1 && tools[0] === "self_destruct_with_target",
        messageKey: "action.white_wolf_king.directive",
        text: text("zh-CN", "action.white_wolf_king.directive"),
      },
    ],
    llmRepair: {
      coerce: {
        ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.llmRepair?.coerce,
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
    baselineAction: (role, request, pickAliveNotSelf, pickAliveByCamp, locale, _world, currentCamp) =>
      request.allowedTools.includes("self_destruct_with_target")
        ? null
        : ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction!(
            role,
            request,
            pickAliveNotSelf,
            pickAliveByCamp,
            locale,
            undefined,
            currentCamp,
          ),
  },
  presentation: nativeRolePresentation("white_wolf_king"),
};
