/**
 * 负责 孤独少女 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition } from "../../../../core/domain";
import type { NativeRoleContributions } from "../contracts";
import {
  LONELY_GIRL_POLICY,
  freshLonelyGirlState,
  getLonelyGirlState,
  readLonelyGirlTool,
} from "./state";
import { authorizedLonelyGirl, projectLonelyGirl } from "./lifecycle";
const parameters = z.strictObject({
  policy: z.literal(LONELY_GIRL_POLICY).default(LONELY_GIRL_POLICY),
});
export const LONELY_GIRL_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.LonelyGirl,
    camp: Camp.Good,
    goodSide: "villager",
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterCity],
    supportedBoardRoles: [
      Role.LonelyGirl,
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Guard,
      Role.Idiot,
    ],
    label: roleName("lonely_girl"),
    skillBrief: text("zh-CN", "role.lonely_girl.brief"),
  },
  runtime: {
    initialVictoryAffiliations: [],
    canSelfDestruct: false,
    init: (role) => {
      if (!getLonelyGirlState(role)) role.privateState.lonelyGirl = freshLonelyGirlState();
    },
    configuration: {
      schema: parameters,
      defaults: { policy: LONELY_GIRL_POLICY },
      apply: (config, value) => ({ ...config, lonelyGirl: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.lonelyGirl ?? {}),
    },
    toolSpecs: [
      {
        name: "choose_admired_player",
        parameters: {
          type: "object",
          properties: { target_id: { type: "integer" } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'choose_admired_player args: {"target_id":number}',
        userPromptHintKey: "action.choose_admired_player.hint",
      },
    ],
    validationRules: {
      choose_admired_player: ({ world, actorId, day, phase, toolCall, lonelyGirlScope }) =>
        !authorizedLonelyGirl(world, actorId, day, phase, lonelyGirlScope)
          ? { code: RuleError.LonelyGirlUnavailable }
          : readLonelyGirlTool(toolCall) &&
              toolCall.name === "choose_admired_player" &&
              toolCall.args.target_id !== actorId &&
              world.getAliveEntityIds().includes(toolCall.args.target_id)
            ? null
            : { code: RuleError.LonelyGirlChoice },
    },
    baselineAction: (_role, request, pickAliveNotSelf) => {
      if (!request.allowedTools.includes("choose_admired_player")) return null;
      const target = pickAliveNotSelf();
      return target === null || target === undefined
        ? null
        : { name: "choose_admired_player", args: { target_id: target } };
    },
  },
  presentation: nativeRolePresentation("lonely_girl"),
};
