/**
 * 负责 狼术师 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
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
import { WOLF_SORCERER_POLICY, WOLF_SORCERER_STATE_SLOT, getWolfSorcererState } from "./state-slot";
import {
  wolfSorcererChoicePending,
  wolfSorcererChoiceTargets,
  wolfSorcererPackReady,
} from "./night-frame";
import { WOLF_SORCERER_EXCHANGE_STAGE } from "./night-stages";
const parameters = z.strictObject({
  policy: z.literal(WOLF_SORCERER_POLICY).default(WOLF_SORCERER_POLICY),
  firstNight: z.union([z.literal(1), z.literal(2)]).default(2),
});
export const WOLF_SORCERER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
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
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    wolfTeam: ownRoleCallback("wolfTeam", {
      wolfTeam: (role, world, currentCamp) => {
        const known = !!getWolfSorcererState(role, currentCamp)?.history.length;
        const active = known && (!world || wolfSorcererPackReady(world));
        return {
          recognizedByPack: known,
          recognizes: known ? "pack" : "none",
          canChat: active,
          canVoteForKill: active,
        };
      },
    }),
    init: ownRoleCallback("init", {
      init: (role, ctx) => {
        const value = parameters.parse(ctx.boardConfig?.wolfSorcerer ?? {});
        WOLF_SORCERER_STATE_SLOT.install(() => role.privateState, value);
      },
    }),
    configuration: {
      schema: parameters,
      defaults: parameters.parse({}),
      apply: (config, value) => ({ ...config, wolfSorcerer: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.wolfSorcerer ?? {}),
    },
    toolSpecs: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs ?? []),
      {
        name: "swap_night_seats",
        ...withTargetOrAbstain(
          {
            type: "object",
            properties: {
              first_id: { type: ["integer", "null"], minimum: 1 },
              second_id: { type: ["integer", "null"], minimum: 1 },
              abstain: { type: "boolean" },
            },
            required: ["first_id", "second_id", "abstain"],
            additionalProperties: false,
          },
          ["first_id", "second_id"],
        ),
        argHint:
          'swap_night_seats args: {"first_id":number|null,"second_id":number|null,"abstain":true|false}',
        userPromptHintKey: "action.swap_night_seats.hint",
      },
    ],
    stageDirectives: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "swap_night_seats",
        messageKey: "action.swap_night_seats.directive",
        text: text("zh-CN", "action.swap_night_seats.directive"),
      },
    ],
    validationRules: ownedToolRules({
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      swap_night_seats: ({ world, role, actorId, day, phase, toolCall }) => {
        if (
          !getWolfSorcererState(role, () => world.getComponent(actorId, COMPONENT.Camp)) ||
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
    }),
    nightStages: [
      WOLF_SORCERER_EXCHANGE_STAGE,
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages ?? []),
    ],
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (role, request, pick, pickCamp, locale, world, currentCamp) => {
        if (
          !request.allowedTools.includes("swap_night_seats") ||
          !world ||
          !getWolfSorcererState(role, currentCamp)
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
        const targets = wolfSorcererChoiceTargets(world, request.context.day);
        return targets.length >= 2
          ? {
              name: "swap_night_seats",
              args: { first_id: targets[0]!, second_id: targets[1]!, abstain: false },
            }
          : { name: "swap_night_seats", args: { first_id: null, second_id: null, abstain: true } };
      },
    }),
  },
  presentation: nativeRolePresentation("wolf_sorcerer"),
};
