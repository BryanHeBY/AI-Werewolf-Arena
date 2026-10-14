/**
 * 负责 千面人 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { Camp, Role, WinCondition } from "../../../../core/domain";
import type { NativeRoleContributions } from "../contracts";
import {
  SHAPESHIFTER_POLICY,
  initializeShapeshifterState,
  readShapeshifterChoice,
} from "./state-ports";
import { authorizedShapeshifterScope } from "./setup";
const parameters = z.strictObject({
  policy: z.literal(SHAPESHIFTER_POLICY).default(SHAPESHIFTER_POLICY),
});
export const SHAPESHIFTER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Shapeshifter,
    camp: Camp.Good,
    goodSide: "villager",
    maxCount: 1,
    label: roleName("shapeshifter"),
    skillBrief: text("zh-CN", "role.shapeshifter.brief"),
    supportedWinConditions: [WinCondition.SlaughterCity],
    supportedBoardRoles: [
      Role.Shapeshifter,
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Guard,
      Role.Idiot,
    ],
  },
  runtime: {
    init: (role, ctx) => {
      initializeShapeshifterState(role, () => ctx.boardConfig?.shapeshifter?.policy ?? SHAPESHIFTER_POLICY);
    },
    configuration: {
      schema: parameters,
      defaults: { policy: SHAPESHIFTER_POLICY },
      apply: (config, value) => ({ ...config, shapeshifter: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.shapeshifter ?? {}),
    },
    toolSpecs: [
      {
        name: "choose_shapeshifter_card",
        parameters: {
          type: "object",
          properties: { slot: { type: "integer", enum: [0, 1] } },
          required: ["slot"],
          additionalProperties: false,
        },
        argHint: 'choose_shapeshifter_card args: {"slot":0|1}',
        userPromptHintKey: "action.choose_shapeshifter_card.hint",
      },
    ],
    validationRules: {
      choose_shapeshifter_card: ({ world, actorId, day, phase, toolCall, shapeshifterScope }) => {
        const scope = authorizedShapeshifterScope(world, actorId, day, phase, shapeshifterScope);
        if (!scope) return { code: RuleError.ShapeshifterUnavailable };
        return toolCall.name === "choose_shapeshifter_card" &&
          scope.allowedSlots.includes(readShapeshifterChoice(toolCall.args) as 0 | 1)
          ? null
          : { code: RuleError.ShapeshifterChoice };
      },
    },
    baselineAction: () => null,
  },
  presentation: nativeRolePresentation("shapeshifter"),
};
