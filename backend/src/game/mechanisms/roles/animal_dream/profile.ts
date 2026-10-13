/**
 * 负责 白猫／子狐／河豚 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { CAT_SKIPPED_VOTE_POLICIES, PUFFER_BALLOT_POLICIES } from "@ai-werewolf-arena/game-contract";
import { Role, Camp, WinCondition } from "../../../../core/domain/identity";
import type { BoardConfig } from "../../../../core/domain/board";
import type { NativeRoleContributions } from "../contracts";
import { freshFoxCubState, freshWhiteCatState, freshPufferfishState } from "./state";
import { canSubmitAnimalTool } from "./requests";
import { ANIMAL_FOX_STAGE } from "./night_stages";
const supported = [
  Role.Wolf,
  Role.WolfBeauty,
  Role.Villager,
  Role.WhiteCat,
  Role.FoxCub,
  Role.Bear,
  Role.Pufferfish,
];
const common = {
  metadata: {
    camp: Camp.Good,
    goodSide: "god" as const,
    maxCount: 1,
    supportedBoardRoles: supported,
    supportedWinConditions: [WinCondition.SlaughterSide],
  },
  runtime: {},
};
function animalBase(config: BoardConfig): BoardConfig {
  return {
    ...config,
    animalDream: { policy: "awa_animal_dream_v1", eliminationPriority: "awa_wolf_priority_v1" },
    bear: config.bear ?? { signalPolicy: "netease_dawn_live_v1" },
    wolfBeauty: config.wolfBeauty ?? { deathLinkPolicy: "awa_exile_poison_v1" },
  };
}
const cat = z.strictObject({
    skippedVotePolicy: z.enum(CAT_SKIPPED_VOTE_POLICIES).default("awa_wait_for_actual_exile_v1"),
  }),
  puffer = z.strictObject({
    ballotPolicy: z.enum(PUFFER_BALLOT_POLICIES).default("awa_final_ballot_v1"),
  }),
  fox = z.strictObject({ policy: z.literal("awa_animal_dream_v1").default("awa_animal_dream_v1") });
export const WHITE_CAT_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...common.metadata,
    role: Role.WhiteCat,
    label: roleName("white_cat"),
    skillBrief: text("zh-CN", "role.white_cat.brief"),
  },
  runtime: {
    ...common.runtime,
    init: (role) => {
      role.privateState.whiteCat = freshWhiteCatState();
    },
    configuration: {
      schema: cat,
      defaults: cat.parse({}),
      apply: (config, value) => ({ ...animalBase(config), whiteCat: cat.parse(value) }),
      serialize: (config) => cat.parse(config.whiteCat ?? {}),
    },
  },
  presentation: nativeRolePresentation("white_cat"),
};
export const FOX_CUB_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...common.metadata,
    role: Role.FoxCub,
    label: roleName("fox_cub"),
    skillBrief: text("zh-CN", "role.fox_cub.brief"),
  },
  runtime: {
    ...common.runtime,
    init: (role) => {
      role.privateState.foxCub = freshFoxCubState();
    },
    configuration: {
      schema: fox,
      defaults: fox.parse({}),
      apply: (config, value) => {
        fox.parse(value);
        return animalBase(config);
      },
      serialize: () => fox.parse({}),
    },
    toolSpecs: [
      {
        name: "fox_distract",
        parameters: {
          type: "object",
          properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'fox_distract args: {"target_id":number|null}',
        userPromptHintKey: "action.fox_distract.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "fox_distract",
        messageKey: "action.fox_distract.directive",
        text: text("zh-CN", "action.fox_distract.directive"),
      },
    ],
    validationRules: {
      fox_distract: ({ world, actorId, phase, day, animalScope, toolCall }) =>
        canSubmitAnimalTool(world, actorId, phase, day ?? 0, animalScope, toolCall)
          ? null
          : { code: RuleError.AnimalActionUnavailable },
    },
    nightStages: [ANIMAL_FOX_STAGE],
    baselineAction: (_role, request) =>
      request.allowedTools.includes("fox_distract")
        ? { name: "fox_distract", args: { target_id: null } }
        : null,
  },
  presentation: nativeRolePresentation("fox_cub"),
};
export const PUFFERFISH_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...common.metadata,
    role: Role.Pufferfish,
    label: roleName("pufferfish"),
    skillBrief: text("zh-CN", "role.pufferfish.brief"),
  },
  runtime: {
    ...common.runtime,
    init: (role) => {
      role.privateState.pufferfish = freshPufferfishState();
    },
    configuration: {
      schema: puffer,
      defaults: puffer.parse({}),
      apply: (config, value) => ({ ...animalBase(config), pufferfish: puffer.parse(value) }),
      serialize: (config) => puffer.parse(config.pufferfish ?? {}),
    },
    toolSpecs: [
      {
        name: "puffer_retaliate",
        parameters: {
          type: "object",
          properties: { activate: { type: "boolean" } },
          required: ["activate"],
          additionalProperties: false,
        },
        argHint: 'puffer_retaliate args: {"activate":boolean}',
        userPromptHintKey: "action.puffer_retaliate.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "puffer_retaliate",
        messageKey: "action.puffer_retaliate.directive",
        text: text("zh-CN", "action.puffer_retaliate.directive"),
      },
    ],
    validationRules: {
      puffer_retaliate: ({ world, actorId, phase, day, animalScope, toolCall }) =>
        canSubmitAnimalTool(world, actorId, phase, day ?? 0, animalScope, toolCall)
          ? null
          : { code: RuleError.AnimalActionUnavailable },
    },
    baselineAction: (_role, request) =>
      request.allowedTools.includes("puffer_retaliate")
        ? { name: "puffer_retaliate", args: { activate: false } }
        : null,
  },
  presentation: nativeRolePresentation("pufferfish"),
};
