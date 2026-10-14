/**
 * 负责 丘比特 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 * 行动规则在原资格／目标读取后的成功尾拒执行退休；初始化、baseline 与玩家知识不按该标记过滤。
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { isRoleExecutionRetired } from "../../../../core/domain/role-execution-authority";
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { CUPID_POLICIES } from "../../../../core/domain/board";
import { Camp, Role, Phase, WinCondition } from "../../../../core/domain/model";
import type { NativeRoleContributions } from "../contracts";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";
import { getCupidState, projectCupidState, installCupidState } from "./state-slot";
import { hasCupidNightCommit } from "./relation";
import { CUPID_STAGE } from "./night_stage";
const parameters = z.strictObject({
  policy: z.enum(CUPID_POLICIES).default("netease_2017_cupid_follows_lovers_v1"),
});
export const CUPID_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Cupid,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    label: roleName("cupid"),
    skillBrief: text("zh-CN", "role.cupid.brief"),
    supportedWinConditions: [WinCondition.SlaughterCity],
    supportedBoardRoles: [
      Role.Cupid,
      Role.Wolf,
      Role.WolfKing,
      Role.WhiteWolfKing,
      Role.Seer,
      Role.Witch,
      Role.Guard,
      Role.Hunter,
      Role.Idiot,
      Role.Villager,
      Role.Knight,
      Role.Dreamer,
      Role.WolfBeauty,
    ],
  },
  runtime: {
    init: installCupidState,
    configuration: {
      schema: parameters,
      defaults: { policy: "netease_2017_cupid_follows_lovers_v1" },
      apply: (config, value) => ({ ...config, cupid: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.cupid ?? {}),
    },
    nightStages: [CUPID_STAGE],
    toolSpecs: [
      {
        name: "choose_lovers",
        parameters: {
          type: "object",
          properties: { first_id: { type: "integer" }, second_id: { type: "integer" } },
          required: ["first_id", "second_id"],
          additionalProperties: false,
        },
        argHint: 'choose_lovers args: {"first_id":number,"second_id":number}',
        userPromptHintKey: "action.choose_lovers.hint",
      },
    ],
    validationRules: {
      choose_lovers: (ctx) => {
        const { world, role, day, phase, toolCall } = ctx;
        const state = getCupidState(role);
        if (
          role.role !== Role.Cupid ||
          world.getComponent(ctx.actorId, COMPONENT.Camp)?.camp !== Camp.Good ||
          !state ||
          state.remaining !== 1 ||
          state.choice !== null ||
          day !== 1 ||
          hasCupidNightCommit(world, day)
        )
          return { code: RuleError.CupidUnavailable };
        if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
        if (toolCall.name !== "choose_lovers") return { code: RuleError.ToolMismatch };
        const { first_id, second_id } = toolCall.args;
        if (
          !Number.isSafeInteger(first_id) ||
          !Number.isSafeInteger(second_id) ||
          first_id === second_id ||
          !isAliveTarget(world, first_id) ||
          !isAliveTarget(world, second_id)
        )
          return { code: RuleError.CupidTarget };
        return isRoleExecutionRetired(role) ? { code: RuleError.CupidUnavailable } : null;
      },
    },
    baselineAction: (_role, request, _other, _camp, _locale, world) => {
      if (!request.allowedTools.includes("choose_lovers") || !world) return null;
      const ids = world.getAliveEntityIds();
      return ids.length < 2
        ? null
        : { name: "choose_lovers", args: { first_id: ids[0]!, second_id: ids[1]! } };
    },
    llmRepair: {
      coerce: {
        choose_lovers: (args) => {
          const first = numberOrNull(args.first_id),
            second = numberOrNull(args.second_id);
          return first === null || second === null ? null : { first_id: first, second_id: second };
        },
      },
    },
  },
  presentation: nativeRolePresentation("cupid"),
};
