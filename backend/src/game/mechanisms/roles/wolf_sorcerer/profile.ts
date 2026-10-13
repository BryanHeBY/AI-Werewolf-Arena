/**
 * 负责 狼术师 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { Role, Camp, WinCondition, Phase } from "../../../../core/domain/identity";
import type { NativeRoleContributions } from "../contracts";
import { WOLF_SORCERER_POLICY, createWolfSorcererState, getWolfSorcererState } from "./state";
import {
  wolfSorcererChoicePending,
  wolfSorcererChoiceTargets,
  wolfSorcererPackReady,
} from "./night_frame";
import { WOLF_SORCERER_EXCHANGE_STAGE } from "./night_stages";
const parameters = z.strictObject({
  policy: z.literal(WOLF_SORCERER_POLICY).default(WOLF_SORCERER_POLICY),
  firstNight: z.union([z.literal(1), z.literal(2)]).default(2),
});
export const WOLF_SORCERER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...WOLF_ROLE_PROFILE.metadata,
    role: Role.WolfSorcerer,
    camp: Camp.Wolf,
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.Wolf,
      Role.Villager,
      Role.Psychic,
      Role.Witch,
      Role.Magician,
      Role.Hunter,
      Role.WolfSorcerer,
    ],
    label: roleName("wolf_sorcerer"),
    skillBrief: text("zh-CN", "role.wolf_sorcerer.brief"),
  },
  runtime: {
    ...WOLF_ROLE_PROFILE.runtime,
    wolfTeam: (role, world) => {
      const known = !!getWolfSorcererState(role)?.history.length;
      const active = known && (!world || wolfSorcererPackReady(world));
      return {
        recognizedByPack: known,
        recognizes: known ? "pack" : "none",
        canChat: active,
        canVoteForKill: active,
      };
    },
    init: (role, ctx) => {
      const value = parameters.parse(ctx.boardConfig?.wolfSorcerer ?? {});
      role.privateState.wolfSorcerer = createWolfSorcererState(value.firstNight);
    },
    configuration: {
      schema: parameters,
      defaults: parameters.parse({}),
      apply: (config, value) => ({ ...config, wolfSorcerer: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.wolfSorcerer ?? {}),
    },
    toolSpecs: [
      ...(WOLF_ROLE_PROFILE.runtime.toolSpecs ?? []),
      {
        name: "swap_night_seats",
        parameters: {
          type: "object",
          properties: {
            first_id: { type: ["integer", "null"], minimum: 1 },
            second_id: { type: ["integer", "null"], minimum: 1 },
            abstain: { type: "boolean" },
          },
          required: ["first_id", "second_id", "abstain"],
          additionalProperties: false,
        },
        argHint:
          'swap_night_seats args: {"first_id":number|null,"second_id":number|null,"abstain":true|false}',
        userPromptHintKey: "action.swap_night_seats.hint",
      },
    ],
    stageDirectives: [
      ...(WOLF_ROLE_PROFILE.runtime.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "swap_night_seats",
        messageKey: "action.swap_night_seats.directive",
        text: text("zh-CN", "action.swap_night_seats.directive"),
      },
    ],
    validationRules: {
      ...WOLF_ROLE_PROFILE.runtime.validationRules,
      swap_night_seats: ({ world, role, actorId, day, phase, toolCall }) => {
        if (
          !getWolfSorcererState(role) ||
          day === undefined ||
          phase !== Phase.Night ||
          toolCall.name !== "swap_night_seats" ||
          !wolfSorcererChoicePending(world, actorId, day)
        )
          return { code: RuleError.WolfSorcererUnavailable };
        const { first_id, second_id, abstain } = toolCall.args;
        if (abstain)
          return first_id === null && second_id === null
            ? null
            : { code: RuleError.WolfSorcererTarget };
        const targets = wolfSorcererChoiceTargets(world, day);
        return first_id !== null &&
          second_id !== null &&
          first_id !== second_id &&
          targets.includes(first_id) &&
          targets.includes(second_id)
          ? null
          : { code: RuleError.WolfSorcererTarget };
      },
    },
    nightStages: [WOLF_SORCERER_EXCHANGE_STAGE, ...(WOLF_ROLE_PROFILE.runtime.nightStages ?? [])],
    baselineAction: (role, request, pick, pickCamp, locale, world) => {
      if (
        !request.allowedTools.includes("swap_night_seats") ||
        !world ||
        !getWolfSorcererState(role)
      )
        return (
          WOLF_ROLE_PROFILE.runtime.baselineAction?.(
            role,
            request,
            pick,
            pickCamp,
            locale,
            world,
          ) ?? null
        );
      const targets = wolfSorcererChoiceTargets(world, request.context.day);
      return targets.length >= 2
        ? {
            name: "swap_night_seats",
            args: { first_id: targets[0]!, second_id: targets[1]!, abstain: false },
          }
        : { name: "swap_night_seats", args: { first_id: null, second_id: null, abstain: true } };
    },
  },
  presentation: nativeRolePresentation("wolf_sorcerer"),
};
