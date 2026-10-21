/**
 * 负责 盗贼 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { THIEF_VALIDATION_SCOPE } from "../../rulesets/action-validation-assembly";
import { ownedToolRules } from "../../engine/actions/validation-queries";

import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { z } from "zod";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { Camp, Role, WinCondition } from "../../domain";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { THIEF_POLICY, initializeThiefState, readThiefChoice } from "./state-ports";
import { authorizedThiefScope } from "./setup";
const parameters = z.strictObject({ policy: z.literal(THIEF_POLICY).default(THIEF_POLICY) });
export const THIEF_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Thief,
    camp: Camp.Good,
    goodSide: "villager",
    maxCount: 1,
    label: roleName("thief"),
    skillBrief: text("zh-CN", "role.thief.brief"),
    supportedWinConditions: [WinCondition.SlaughterCity],
    supportedBoardRoles: [
      Role.Thief,
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
    init: ownRoleCallback("init", {
      init: (role, ctx) => {
        initializeThiefState(role, () => ctx.boardConfig?.thief?.policy ?? THIEF_POLICY);
      },
    }),
    configuration: {
      schema: parameters,
      defaults: { policy: THIEF_POLICY },
      apply: (config, value) => ({ ...config, thief: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.thief ?? {}),
    },
    toolSpecs: [
      {
        name: "choose_thief_card",
        executionFeedback: { kind: "resolved", events: ["thief_identity_chosen"] },
        parameters: {
          type: "object",
          properties: { slot: { type: "integer", enum: [0, 1] } },
          required: ["slot"],
          additionalProperties: false,
        },
        argHint: 'choose_thief_card args: {"slot":0|1}',
        userPromptHintKey: "action.choose_thief_card.hint",
      },
    ],
    validationRules: ownedToolRules(
      {
        choose_thief_card: ({ world, actorId, day, phase, toolCall, scope: thiefScope }) => {
          if (!authorizedThiefScope(world, actorId, day, phase, thiefScope))
            return { code: RuleError.ThiefUnavailable };
          return toolCall.name === "choose_thief_card" &&
            readThiefChoice(toolCall.args) !== undefined
            ? null
            : { code: RuleError.ThiefChoice };
        },
      },
      THIEF_VALIDATION_SCOPE,
    ),
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (_role, request) =>
        request.allowedTools.includes("choose_thief_card")
          ? { name: "choose_thief_card", args: { slot: 0 } }
          : null,
    }),
  },
  presentation: nativeRolePresentation("thief"),
};
