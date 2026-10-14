/**
 * 负责 野孩子 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { Camp, Role, WinCondition } from "../../../../core/domain";
import type { NativeRoleContributions } from "../contracts";
import { WOLF_NIGHT_STAGES } from "../wolf/ability-ports";
import { WOLF_TOOL_SPECS, WOLF_STAGE_DIRECTIVES } from "../wolf/ability-ports";
import { WOLF_VALIDATION_RULES } from "../wolf/ability-ports";
import { WOLF_LLM_REPAIR_PACK } from "../wolf/ability-ports";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import {
  WILD_CHILD_POLICY,
  freshWildChildState,
  getWildChildState,
  readWildChildTool,
} from "./state";
import {
  authorizedWildChild,
  projectWildChild,
  wildChildPackActive,
  wildChildPackKnown,
} from "./lifecycle";
const parameters = z.strictObject({
  policy: z.literal(WILD_CHILD_POLICY).default(WILD_CHILD_POLICY),
});
export const WILD_CHILD_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.WildChild,
    camp: Camp.Good,
    goodSide: "villager",
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterCity],
    supportedBoardRoles: [
      Role.WildChild,
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Guard,
      Role.Idiot,
    ],
    label: roleName("wild_child"),
    skillBrief: text("zh-CN", "role.wild_child.brief"),
  },
  runtime: {
    canSelfDestruct: false,
    init: (role) => {
      if (!getWildChildState(role)) role.privateState.wildChild = freshWildChildState();
    },
    configuration: {
      schema: parameters,
      defaults: { policy: WILD_CHILD_POLICY },
      apply: (config, value) => ({ ...config, wildChild: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.wildChild ?? {}),
    },
    wolfTeam: (role, world) => ({
      recognizedByPack: wildChildPackKnown(role, world),
      recognizes: wildChildPackKnown(role, world) ? "pack" : "none",
      canChat: wildChildPackActive(role, world),
      canVoteForKill: wildChildPackActive(role, world),
    }),
    nightStages: WOLF_NIGHT_STAGES,
    stageDirectives: WOLF_STAGE_DIRECTIVES,
    toolSpecs: [
      ...WOLF_TOOL_SPECS.filter((spec) => spec.name !== "self_destruct"),
      {
        name: "choose_wild_model",
        parameters: {
          type: "object",
          properties: { target_id: { type: "integer" } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'choose_wild_model args: {"target_id":number}',
        userPromptHintKey: "action.choose_wild_model.hint",
      },
    ],
    validationRules: {
      ...WOLF_VALIDATION_RULES,
      choose_wild_model: ({ world, actorId, day, phase, toolCall, wildChildScope }) =>
        !authorizedWildChild(world, actorId, day, phase, wildChildScope)
          ? { code: RuleError.WildChildUnavailable }
          : readWildChildTool(toolCall) &&
              toolCall.name === "choose_wild_model" &&
              toolCall.args.target_id !== actorId &&
              world.getAliveEntityIds().includes(toolCall.args.target_id)
            ? null
            : { code: RuleError.WildChildChoice },
    },
    llmRepair: WOLF_LLM_REPAIR_PACK,
    baselineAction: (role, request, pickAliveNotSelf, pickAliveByCamp, locale, world) =>
      request.allowedTools.includes("choose_wild_model")
        ? { name: "choose_wild_model", args: { target_id: pickAliveNotSelf()! } }
        : (ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction?.(
            role,
            request,
            pickAliveNotSelf,
            pickAliveByCamp,
            locale,
            world,
          ) ?? null),
  },
  presentation: nativeRolePresentation("wild_child"),
};
