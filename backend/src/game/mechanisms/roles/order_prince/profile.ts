/**
 * 负责 定序王子 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition, Phase } from "../../../../core/domain/identity";
import type { NativeRoleContributions } from "../contracts";
import { ORDER_PRINCE_POLICY, createOrderPrinceState, getOrderPrinceState } from "./state";
import { orderPrinceChoicePending } from "./authority";
const parameters = z.strictObject({
  policy: z.literal(ORDER_PRINCE_POLICY).default(ORDER_PRINCE_POLICY),
});
export const ORDER_PRINCE_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.OrderPrince,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.TimeWolfConsort,
      Role.Guard,
      Role.Trickster,
      Role.Magician,
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.OrderPrince,
    ],
    label: roleName("order_prince"),
    skillBrief: text("zh-CN", "role.order_prince.brief"),
  },
  runtime: {
    init: (role) => {
      role.privateState.orderPrince = createOrderPrinceState();
    },
    configuration: {
      schema: parameters,
      defaults: parameters.parse({}),
      apply: (config, value) => ({ ...config, orderPrince: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.orderPrince ?? {}),
    },
    toolSpecs: [
      {
        name: "reset_exile_vote",
        parameters: {
          type: "object",
          properties: { activate: { type: "boolean" } },
          required: ["activate"],
          additionalProperties: false,
        },
        argHint: 'reset_exile_vote args: {"activate":true|false}',
        userPromptHintKey: "action.reset_exile_vote.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "reset_exile_vote",
        messageKey: "action.reset_exile_vote.directive",
        text: text("zh-CN", "action.reset_exile_vote.directive"),
      },
    ],
    validationRules: {
      reset_exile_vote: ({ world, role, actorId, day, phase, toolCall }) => {
        if (
          !getOrderPrinceState(role) ||
          day === undefined ||
          phase !== Phase.Voting ||
          toolCall.name !== "reset_exile_vote" ||
          !orderPrinceChoicePending(world, actorId, day)
        )
          return { code: RuleError.OrderPrinceUnavailable };
        return null;
      },
    },
    baselineAction: (role, request) =>
      request.allowedTools.includes("reset_exile_vote") && getOrderPrinceState(role)
        ? { name: "reset_exile_vote", args: { activate: true } }
        : null,
  },
  presentation: nativeRolePresentation("order_prince"),
};
