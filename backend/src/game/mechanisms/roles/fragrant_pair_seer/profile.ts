/**
 * 负责 寻香魅影／觉醒预言家 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role, WinCondition } from "../../../../core/domain/identity";
import type { NativeRoleContributions, RoleRuntimeContribution } from "../contracts";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { freshFragrantState, FRAGRANT_PAIR_POLICY } from "./state";
import { installPairStateSlot } from "./pair-state-slot";
import { fragrantKnownWolfIds, fragrantRoleKnifeEligible } from "./authority";
import { canSubmitFragrantPairChoice } from "./requests";
import { FRAGRANT_BIND_STAGE, PAIR_INSPECTION_STAGE } from "./night_stages";
const policy = z.strictObject({
  policy: z.literal(FRAGRANT_PAIR_POLICY).default(FRAGRANT_PAIR_POLICY),
});
const common = {
  metadata: {
    maxCount: 1,
    supportedBoardRoles: [
      Role.FragrantPhantom,
      Role.AwakenedSeer,
      Role.Wolf,
      Role.Villager,
      Role.Witch,
      Role.Hunter,
      Role.Guard,
    ],
    supportedWinConditions: [WinCondition.SlaughterSide],
  },
  runtime: {
    configuration: {
      schema: policy,
      defaults: policy.parse({}),
      apply: (
        config: Parameters<NonNullable<RoleRuntimeContribution["configuration"]>["apply"]>[0],
        value: unknown,
      ) => ({ ...config, fragrantPairSeer: policy.parse(value) }),
      serialize: (
        config: Parameters<NonNullable<RoleRuntimeContribution["configuration"]>["serialize"]>[0],
      ) => policy.parse(config.fragrantPairSeer ?? {}),
    },
  },
};
const pairSchema = {
  type: "array",
  items: { type: "integer", minimum: 1 },
  minItems: 2,
  maxItems: 2,
  uniqueItems: true,
};
export const FRAGRANT_PHANTOM_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    ...common.metadata,
    role: Role.FragrantPhantom,
    camp: Camp.Wolf,
    label: roleName("fragrant_phantom"),
    skillBrief: text("zh-CN", "role.fragrant_phantom.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    ...common.runtime,
    canSelfDestruct: false,
    wolfTeam: (role, world) => ({
      recognizedByPack: false,
      recognizes: "none",
      canChat: false,
      canVoteForKill: !!world && fragrantRoleKnifeEligible(world, role),
    }),
    knownTeammates: (role, world) => fragrantKnownWolfIds(world, role),
    init: (role) => {
      role.privateState.fragrant = freshFragrantState();
    },
    toolSpecs: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs ?? []).filter((s) => s.name === "kill_vote"),
      {
        name: "bind_fragrant_pair",
        parameters: {
          type: "object",
          properties: { target_ids: { ...pairSchema, type: ["array", "null"] } },
          required: ["target_ids"],
          additionalProperties: false,
        },
        argHint: 'bind_fragrant_pair args: {"target_ids":[number,number]|null}',
        userPromptHintKey: "action.bind_fragrant_pair.hint",
      },
    ],
    stageDirectives: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "bind_fragrant_pair",
        messageKey: "action.bind_fragrant_pair.directive",
        text: text("zh-CN", "action.bind_fragrant_pair.directive"),
      },
    ],
    validationRules: {
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      bind_fragrant_pair: ({ world, actorId, phase, day, fragrantPairScope, toolCall }) =>
        canSubmitFragrantPairChoice(world, actorId, phase, day ?? 0, fragrantPairScope, toolCall)
          ? null
          : { code: RuleError.FragrantPairUnavailable },
    },
    nightStages: [...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages ?? []), FRAGRANT_BIND_STAGE],
    baselineAction: (role, request, ...rest) =>
      request.allowedTools.includes("bind_fragrant_pair")
        ? { name: "bind_fragrant_pair", args: { target_ids: null } }
        : (ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction?.(role, request, ...rest) ?? null),
  },
  presentation: nativeRolePresentation("fragrant_phantom"),
};
export const AWAKENED_SEER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...common.metadata,
    role: Role.AwakenedSeer,
    camp: Camp.Good,
    goodSide: "god",
    label: roleName("awakened_seer"),
    skillBrief: text("zh-CN", "role.awakened_seer.brief"),
  },
  runtime: {
    ...common.runtime,
    canSelfDestruct: false,
    init: (role) => {
      installPairStateSlot(role);
    },
    toolSpecs: [
      {
        name: "check_pair",
        parameters: {
          type: "object",
          properties: { target_ids: pairSchema },
          required: ["target_ids"],
          additionalProperties: false,
        },
        argHint: 'check_pair args: {"target_ids":[number,number]}',
        userPromptHintKey: "action.check_pair.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "check_pair",
        messageKey: "action.check_pair.directive",
        text: text("zh-CN", "action.check_pair.directive"),
      },
    ],
    validationRules: {
      check_pair: ({ world, actorId, phase, day, fragrantPairScope, toolCall }) =>
        canSubmitFragrantPairChoice(world, actorId, phase, day ?? 0, fragrantPairScope, toolCall)
          ? null
          : { code: RuleError.FragrantPairUnavailable },
    },
    nightStages: [PAIR_INSPECTION_STAGE],
    baselineAction: (_role, request) => {
      const ids = request.context.pair_check_candidates;
      return request.allowedTools.includes("check_pair") && ids && ids.length >= 2
        ? { name: "check_pair", args: { target_ids: [ids[0]!, ids[1]!] } }
        : null;
    },
  },
  presentation: nativeRolePresentation("awakened_seer"),
};
