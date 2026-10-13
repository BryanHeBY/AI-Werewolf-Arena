/**
 * 负责 蚀时狼妃 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition, Phase } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { TIME_CONSORT_POLICY, createTimeConsortState, getTimeConsortState } from "./state";
import { timeConsortChoicePending, timeConsortChoiceTargets } from "./night_frame";
import { TIME_CONSORT_LOCK_STAGE } from "./night_stages";
const parameters = z.strictObject({
  policy: z.literal(TIME_CONSORT_POLICY).default(TIME_CONSORT_POLICY),
  reflectionScope: z.enum(["whole_night", "first_effect"]).default("whole_night"),
});
export const TIME_CONSORT_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.TimeWolfConsort,
  camp: Camp.Wolf,
  maxCount: 1,
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Guard,
    Role.OrderPrince,
    Role.TimeWolfConsort,
  ],
  label: roleName("time_wolf_consort"),
  skillBrief: text("zh-CN", "role.time_wolf_consort.brief"),
  init: (role, ctx) => {
    const value = parameters.parse(ctx.boardConfig?.timeConsort ?? {});
    role.privateState.timeConsort = createTimeConsortState(value.reflectionScope);
  },
  ...nativeRolePresentation("time_wolf_consort"),
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, timeConsort: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.timeConsort ?? {}),
  },
  toolSpecs: [
    ...(WOLF_ROLE_PROFILE.toolSpecs ?? []),
    {
      name: "lock_time",
      parameters: {
        type: "object",
        properties: {
          target_id: { type: ["integer", "null"], minimum: 1 },
          abstain: { type: "boolean" },
        },
        required: ["target_id", "abstain"],
        additionalProperties: false,
      },
      argHint: 'lock_time args: {"target_id":number|null,"abstain":true|false}',
      userPromptHintKey: "action.lock_time.hint",
    },
  ],
  stageDirectives: [
    ...(WOLF_ROLE_PROFILE.stageDirectives ?? []),
    {
      match: (tools) => tools.length === 1 && tools[0] === "lock_time",
      messageKey: "action.lock_time.directive",
      text: text("zh-CN", "action.lock_time.directive"),
    },
  ],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    lock_time: ({ world, role, actorId, day, phase, toolCall }) => {
      if (
        !getTimeConsortState(role) ||
        day === undefined ||
        phase !== Phase.Night ||
        toolCall.name !== "lock_time" ||
        !timeConsortChoicePending(world, actorId, day)
      )
        return { code: RuleError.TimeConsortUnavailable };
      const { target_id, abstain } = toolCall.args;
      if (abstain) return target_id === null ? null : { code: RuleError.TimeConsortTarget };
      return target_id !== null && timeConsortChoiceTargets(world, day).includes(target_id)
        ? null
        : { code: RuleError.TimeConsortTarget };
    },
  },
  nightStages: [TIME_CONSORT_LOCK_STAGE, ...(WOLF_ROLE_PROFILE.nightStages ?? [])],
  baselineAction: (role, request, pick, pickCamp, locale, world) => {
    if (!request.allowedTools.includes("lock_time") || !world || !getTimeConsortState(role))
      return (
        WOLF_ROLE_PROFILE.baselineAction?.(role, request, pick, pickCamp, locale, world) ?? null
      );
    const targets = timeConsortChoiceTargets(world, request.context.day);
    return targets.length >= 1
      ? {
          name: "lock_time",
          args: { target_id: targets[0]!, abstain: false },
        }
      : { name: "lock_time", args: { target_id: null, abstain: true } };
  },
};
