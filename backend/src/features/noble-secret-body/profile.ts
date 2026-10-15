/**
 * 负责 夜之贵族／觉醒愚者 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { ownRoleCallback, roleMethod } from "../../rulesets/roles/owned-bindings";
import { createNobleValidationRules, createSecretBodyValidationRules } from "./validation-rules";

import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role, WinCondition } from "../../domain/identity";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { installNobleState, installSecretBodyState, readNobleState } from "./state";
import { NOBLE_CHOICE_STAGE, SECRET_BODY_STAGE } from "./night-stages";
const noble = z.strictObject({
  wolfActionPolicy: z.enum(["standard", "no_blast_no_self_knife"]).default("standard"),
});
const body = z.strictObject({
  protectionRepeatPolicy: z
    .enum(["awa_nonconsecutive_nights_v1", "awa_repeat_v1"])
    .default("awa_nonconsecutive_nights_v1"),
});
const common = {
  metadata: {
    maxCount: 1,
    supportedBoardRoles: [
      Role.NightNoble,
      Role.AwakenedIdiot,
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.DemonHunter,
    ],
    supportedWinConditions: [WinCondition.SlaughterSide],
  },
  runtime: {},
};
const parameters = {
  type: "object",
  properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
  required: ["target_id"],
  additionalProperties: false,
};
export const NIGHT_NOBLE_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    ...common.metadata,
    role: Role.NightNoble,
    camp: Camp.Wolf,
    label: roleName("night_noble"),
    skillBrief: text("zh-CN", "role.night_noble.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    ...common.runtime,
    init: ownRoleCallback("init", {
      init: (role, ctx) => {
        // 完整安装由既有数据 owner 持有；原 parse callee／receiver 与板子读取留在惰性政策输入内。
        installNobleState(
          role,
          () => noble.parse(ctx.boardConfig?.nightNoble ?? {}).wolfActionPolicy,
        );
      },
    }),
    canSelfDestruct: ownRoleCallback("canSelfDestruct", {
      canSelfDestruct: (role) =>
        readNobleState(
          (
            role.privateState as {
              readonly noble?: unknown;
            }
          ).noble,
        )?.wolfActionPolicy === "standard",
    }),
    configuration: {
      schema: noble,
      defaults: noble.parse({}),
      apply: (config, value) => ({
        ...config,
        nobleSecretBody: { policy: "awa_noble_secret_body_v1" },
        nightNoble: noble.parse(value),
      }),
      serialize: (config) => noble.parse(config.nightNoble ?? {}),
    },
    toolSpecs: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs ?? []),
      {
        name: "choose_servant",
        parameters,
        argHint: 'choose_servant args: {"target_id":number|null}',
        userPromptHintKey: "action.choose_servant.hint",
      },
    ],
    stageDirectives: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "choose_servant",
        messageKey: "action.choose_servant.directive",
        text: text("zh-CN", "action.choose_servant.directive"),
      },
    ],
    validationRules: createNobleValidationRules(),
    nightStages: [...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages ?? []), NOBLE_CHOICE_STAGE],
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (role, request, ...rest) =>
        request.allowedTools.includes("choose_servant")
          ? { name: "choose_servant", args: { target_id: null } }
          : (roleMethod(ORDINARY_WOLF_CONTRIBUTIONS.runtime, "baselineAction")?.(
              role,
              request,
              ...rest,
            ) ?? null),
    }),
  },
  presentation: nativeRolePresentation("night_noble"),
};
export const AWAKENED_IDIOT_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...common.metadata,
    role: Role.AwakenedIdiot,
    camp: Camp.Good,
    goodSide: "god",
    label: roleName("awakened_idiot"),
    skillBrief: text("zh-CN", "role.awakened_idiot.brief"),
  },
  runtime: {
    ...common.runtime,
    canSelfDestruct: false,
    init: ownRoleCallback("init", {
      init: (role, ctx) => {
        // owner 读取原左值容器之后才求值此政策，不把配置提前解析成值或另存状态。
        installSecretBodyState(
          role,
          () => body.parse(ctx.boardConfig?.awakenedIdiot ?? {}).protectionRepeatPolicy,
        );
      },
    }),
    configuration: {
      schema: body,
      defaults: body.parse({}),
      apply: (config, value) => ({
        ...config,
        nobleSecretBody: { policy: "awa_noble_secret_body_v1" },
        awakenedIdiot: body.parse(value),
      }),
      serialize: (config) => body.parse(config.awakenedIdiot ?? {}),
    },
    toolSpecs: [
      {
        name: "protect_secret_body",
        parameters,
        argHint: 'protect_secret_body args: {"target_id":number|null}',
        userPromptHintKey: "action.protect_secret_body.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "protect_secret_body",
        messageKey: "action.protect_secret_body.directive",
        text: text("zh-CN", "action.protect_secret_body.directive"),
      },
    ],
    validationRules: createSecretBodyValidationRules(),
    nightStages: [SECRET_BODY_STAGE],
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (_role, request) =>
        request.allowedTools.includes("protect_secret_body")
          ? { name: "protect_secret_body", args: { target_id: null } }
          : null,
    }),
  },
  presentation: nativeRolePresentation("awakened_idiot"),
};
