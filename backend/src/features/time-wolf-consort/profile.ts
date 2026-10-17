/**
 * 负责 蚀时狼妃 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 当前阵营通过调用方的晚读 source 传入；目录阵营仅为初值，不替代现场 Camp 或授予许可。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { withTargetOrAbstain } from "../../engine/actions/argument-variants";
import { ownRoleCallback, roleMethod } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules } from "../../engine/actions/validation-queries";

import { COMPONENT } from "../../domain/components/names";
import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { Role, Camp, WinCondition, Phase } from "../../domain/identity";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { TIME_CONSORT_POLICY, TIME_CONSORT_STATE_SLOT, getTimeConsortState } from "./state-slot";
import { timeConsortChoicePending, timeConsortChoiceTargets } from "./night-frame";
import { TIME_CONSORT_LOCK_STAGE } from "./night-stages";
const parameters = z.strictObject({
  policy: z.literal(TIME_CONSORT_POLICY).default(TIME_CONSORT_POLICY),
  reflectionScope: z.enum(["whole_night", "first_effect"]).default("whole_night"),
});
export const TIME_CONSORT_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
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
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    init: ownRoleCallback("init", {
      init: (role, ctx) => {
        const value = parameters.parse(ctx.boardConfig?.timeConsort ?? {});
        // 原参数解析之后，仍先读左值 privateState，再读 reflectionScope 并创建／赋值。
        TIME_CONSORT_STATE_SLOT.install(() => role.privateState, value);
      },
    }),
    configuration: {
      schema: parameters,
      defaults: parameters.parse({}),
      apply: (config, value) => ({ ...config, timeConsort: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.timeConsort ?? {}),
    },
    toolSpecs: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs ?? []),
      {
        name: "lock_time",
        ...withTargetOrAbstain({
          type: "object",
          properties: {
            target_id: { type: ["integer", "null"], minimum: 1 },
            abstain: { type: "boolean" },
          },
          required: ["target_id", "abstain"],
          additionalProperties: false,
        }),
        argHint: 'lock_time args: {"target_id":number|null,"abstain":true|false}',
        userPromptHintKey: "action.lock_time.hint",
      },
    ],
    stageDirectives: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "lock_time",
        messageKey: "action.lock_time.directive",
        text: text("zh-CN", "action.lock_time.directive"),
      },
    ],
    validationRules: ownedToolRules({
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      lock_time: ({ world, role, actorId, day, phase, toolCall }) => {
        if (
          !getTimeConsortState(role, () => world.getComponent(actorId, COMPONENT.Camp)) ||
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
    }),
    nightStages: [
      TIME_CONSORT_LOCK_STAGE,
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages ?? []),
    ],
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (role, request, pick, pickCamp, locale, world, currentCamp) => {
        if (
          !request.allowedTools.includes("lock_time") ||
          !world ||
          !getTimeConsortState(role, currentCamp)
        )
          return (
            roleMethod(ORDINARY_WOLF_CONTRIBUTIONS.runtime, "baselineAction")?.(
              role,
              request,
              pick,
              pickCamp,
              locale,
              world,
              currentCamp,
            ) ?? null
          );
        const targets = timeConsortChoiceTargets(world, request.context.day);
        return targets.length >= 1
          ? {
              name: "lock_time",
              args: { target_id: targets[0]!, abstain: false },
            }
          : { name: "lock_time", args: { target_id: null, abstain: true } };
      },
    }),
  },
  presentation: nativeRolePresentation("time_wolf_consort"),
};
