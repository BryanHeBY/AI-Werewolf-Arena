/**
 * 负责 炼金魔女／狼鸦之爪 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Phase, Role, WinCondition } from "../../../../core/domain/identity";
import type { NativeRoleContributions } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { ALCHEMIST_MIST_STAGE, RAVEN_KNIFE_STAGE } from "./night_stages";
import {
  MIST_RAVEN_POLICY,
  createAlchemistState,
  createRavenState,
  readAlchemistState,
  readRavenState,
  selectMist,
  selectRavenKnife,
} from "./state";
import {
  isMistRavenBoard,
  mistCasterId,
  mistChoiceTargets,
  ravenAwakened,
  ravenKnownTeammates,
  ravenKnifeTargets,
  snakeWindowTargets,
} from "./night_frame";

const parameters = z.strictObject({
  policy: z.literal(MIST_RAVEN_POLICY).default(MIST_RAVEN_POLICY),
});
const supported = [
  Role.Wolf,
  Role.RavenClawWolf,
  Role.Villager,
  Role.Alchemist,
  Role.Seer,
  Role.Dreamer,
  Role.Idiot,
];
const configuration = {
  schema: parameters,
  defaults: parameters.parse({}),
  apply: (config: import("../../../../core/domain/board").BoardConfig, value: unknown) => ({
    ...config,
    mistRaven: parameters.parse(value),
  }),
  serialize: (config: import("../../../../core/domain/board").BoardConfig) =>
    parameters.parse(config.mistRaven ?? {}),
};
export const ALCHEMIST_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Alchemist,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    supportedBoardRoles: supported,
    supportedWinConditions: [WinCondition.SlaughterSide],
    label: roleName("alchemist"),
    skillBrief: text("zh-CN", "role.alchemist.brief"),
  },
  runtime: {
    nightStages: [ALCHEMIST_MIST_STAGE],
    canSelfDestruct: false,
    configuration,
    init: (role, ctx) => {
      parameters.parse(ctx.boardConfig?.mistRaven ?? {});
      role.privateState.alchemist = createAlchemistState();
    },
    toolSpecs: [
      {
        name: "cast_mist",
        parameters: {
          type: "object",
          properties: {
            target_ids: {
              type: ["array", "null"],
              items: { type: "integer", minimum: 1 },
              minItems: 3,
              maxItems: 3,
            },
          },
          required: ["target_ids"],
          additionalProperties: false,
        },
        argHint: 'cast_mist args: {"target_ids":[number,number,number]|null}',
        userPromptHintKey: "action.cast_mist.hint",
      },
      {
        name: "use_snake",
        parameters: {
          type: "object",
          properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'use_snake args: {"target_id":number|null}',
        userPromptHintKey: "action.use_snake.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "cast_mist",
        messageKey: "action.cast_mist.directive",
        text: text("zh-CN", "action.cast_mist.directive"),
      },
      {
        match: (tools) => tools.length === 1 && tools[0] === "use_snake",
        messageKey: "action.use_snake.directive",
        text: text("zh-CN", "action.use_snake.directive"),
      },
    ],
    validationRules: {
      cast_mist: ({ world, role, actorId, day, phase, toolCall }) => {
        if (
          phase !== Phase.Night ||
          day === undefined ||
          toolCall.name !== "cast_mist" ||
          !isMistRavenBoard(world) ||
          mistCasterId(world, "alchemist") !== actorId
        )
          return { code: RuleError.MistUnavailable };
        const state = readAlchemistState(
            (
              role.privateState as {
                readonly alchemist?: unknown;
              }
            ).alchemist,
          ),
          targets = mistChoiceTargets(world, day);
        if (!state || targets.length < 3) return { code: RuleError.MistUnavailable };
        try {
          selectMist(state, day, toolCall.args.target_ids, targets);
          return null;
        } catch {
          return { code: RuleError.MistTarget };
        }
      },
      use_snake: ({ world, actorId, day, phase, toolCall }) => {
        if (
          phase !== Phase.Day ||
          day === undefined ||
          toolCall.name !== "use_snake" ||
          !isMistRavenBoard(world)
        )
          return { code: RuleError.SnakeUnavailable };
        try {
          const targets = snakeWindowTargets(world, day, actorId),
            target = toolCall.args.target_id;
          return target === null || targets.includes(target)
            ? null
            : { code: RuleError.SnakeTarget };
        } catch {
          return { code: RuleError.SnakeUnavailable };
        }
      },
    },
    baselineAction: (_role, request) => {
      if (request.allowedTools.includes("cast_mist"))
        return { name: "cast_mist", args: { target_ids: null } };
      if (request.allowedTools.includes("use_snake"))
        return {
          name: "use_snake",
          args: { target_id: request.context.snake_candidates?.[0] ?? null },
        };
      return null;
    },
  },
  presentation: nativeRolePresentation("alchemist"),
};
export const RAVEN_CLAW_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...WOLF_ROLE_PROFILE.metadata,
    role: Role.RavenClawWolf,
    camp: Camp.Wolf,
    maxCount: 1,
    supportedBoardRoles: supported,
    supportedWinConditions: [WinCondition.SlaughterSide],
    label: roleName("raven_claw_wolf"),
    skillBrief: text("zh-CN", "role.raven_claw_wolf.brief"),
  },
  runtime: {
    ...WOLF_ROLE_PROFILE.runtime,
    nightStages: [...(WOLF_ROLE_PROFILE.runtime.nightStages ?? []), RAVEN_KNIFE_STAGE],
    canSelfDestruct: false,
    configuration,
    init: (role, ctx) => {
      parameters.parse(ctx.boardConfig?.mistRaven ?? {});
      role.privateState.ravenClaw = createRavenState();
    },
    wolfTeam: (_role, world) => {
      const awake = !!world && isMistRavenBoard(world) && ravenAwakened(world);
      return { recognizedByPack: true, recognizes: "none", canChat: awake, canVoteForKill: awake };
    },
    knownTeammates: (_role, world) => (isMistRavenBoard(world) ? ravenKnownTeammates(world) : []),
    toolSpecs: [
      ...(WOLF_ROLE_PROFILE.runtime.toolSpecs ?? []),
      {
        name: "raven_knife",
        parameters: {
          type: "object",
          properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'raven_knife args: {"target_id":number|null}',
        userPromptHintKey: "action.raven_knife.hint",
      },
    ],
    stageDirectives: [
      ...(WOLF_ROLE_PROFILE.runtime.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "raven_knife",
        messageKey: "action.raven_knife.directive",
        text: text("zh-CN", "action.raven_knife.directive"),
      },
    ],
    validationRules: {
      ...WOLF_ROLE_PROFILE.runtime.validationRules,
      raven_knife: ({ world, role, actorId, day, phase, toolCall }) => {
        if (
          phase !== Phase.Night ||
          day === undefined ||
          toolCall.name !== "raven_knife" ||
          !isMistRavenBoard(world) ||
          mistCasterId(world, "raven_claw_wolf") !== actorId
        )
          return { code: RuleError.RavenKnifeUnavailable };
        const state = readRavenState(
            (
              role.privateState as {
                readonly ravenClaw?: unknown;
              }
            ).ravenClaw,
          ),
          targets = ravenKnifeTargets(world, day);
        if (!state || !targets.length) return { code: RuleError.RavenKnifeUnavailable };
        try {
          selectRavenKnife(state, day, actorId, toolCall.args.target_id, [actorId, ...targets]);
          return null;
        } catch {
          return { code: RuleError.RavenKnifeTarget };
        }
      },
    },
    baselineAction: (role, request, pick, pickCamp, locale, world) =>
      request.allowedTools.includes("raven_knife")
        ? { name: "raven_knife", args: { target_id: null } }
        : (WOLF_ROLE_PROFILE.runtime.baselineAction?.(
            role,
            request,
            pick,
            pickCamp,
            locale,
            world,
          ) ?? null),
  },
  presentation: nativeRolePresentation("raven_claw_wolf"),
};
