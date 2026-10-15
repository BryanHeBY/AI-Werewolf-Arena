/**
 * 负责 诡术师 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 当前阵营通过调用方的晚读 source 传入；目录阵营仅为初值，不替代现场 Camp 或授予许可。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { ownedToolRules } from "../../engine/actions/validation-queries";

import { COMPONENT } from "../../domain/components/names";
import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { Role, Camp, WinCondition, Phase } from "../../domain/identity";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { TRICKSTER_POLICY, getTricksterState, TRICKSTER_STATE_SLOT } from "./state-slot";
import {
  tricksterChoicePending,
  tricksterChoiceTargets,
  tricksterMayPass,
  tricksterPackReady,
} from "./night-frame";
import { TRICKSTER_EXCHANGE_STAGE } from "./night-stages";
const parameters = z.strictObject({
  policy: z.literal(TRICKSTER_POLICY).default(TRICKSTER_POLICY),
});
export const TRICKSTER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.Trickster,
    camp: Camp.Wolf,
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Magician,
      Role.OrderPrince,
      Role.Trickster,
    ],
    label: roleName("trickster"),
    skillBrief: text("zh-CN", "role.trickster.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    wolfTeam: (role, world, currentCamp) => {
      const ready =
        !!getTricksterState(role, currentCamp)?.history.length &&
        (!world || tricksterPackReady(world));
      return {
        recognizedByPack: ready,
        recognizes: ready ? "pack" : "none",
        canChat: ready,
        canVoteForKill: ready,
      };
    },
    init: (role) => {
      TRICKSTER_STATE_SLOT.install(() => role.privateState);
    },
    configuration: {
      schema: parameters,
      defaults: parameters.parse({}),
      apply: (config, value) => ({ ...config, trickster: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.trickster ?? {}),
    },
    toolSpecs: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs ?? []),
      {
        name: "swap_exile_targets",
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
          'swap_exile_targets args: {"first_id":number|null,"second_id":number|null,"abstain":true|false}',
        userPromptHintKey: "action.swap_exile_targets.hint",
      },
    ],
    stageDirectives: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "swap_exile_targets",
        messageKey: "action.swap_exile_targets.directive",
        text: text("zh-CN", "action.swap_exile_targets.directive"),
      },
    ],
    validationRules: ownedToolRules({
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      swap_exile_targets: ({ world, role, actorId, day, phase, toolCall }) => {
        if (
          !getTricksterState(role, () => world.getComponent(actorId, COMPONENT.Camp)) ||
          day === undefined ||
          phase !== Phase.Night ||
          toolCall.name !== "swap_exile_targets" ||
          !tricksterChoicePending(world, actorId, day)
        )
          return { code: RuleError.TricksterUnavailable };
        const { first_id, second_id, abstain } = toolCall.args;
        if (abstain)
          return first_id === null && second_id === null && tricksterMayPass(world, day)
            ? null
            : { code: RuleError.TricksterTarget };
        const targets = tricksterChoiceTargets(world, day);
        return first_id !== null &&
          second_id !== null &&
          first_id !== second_id &&
          targets.includes(first_id) &&
          targets.includes(second_id)
          ? null
          : { code: RuleError.TricksterTarget };
      },
    }),
    nightStages: [
      TRICKSTER_EXCHANGE_STAGE,
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages ?? []),
    ],
    baselineAction: (role, request, pick, pickCamp, locale, world, currentCamp) => {
      if (
        !request.allowedTools.includes("swap_exile_targets") ||
        !world ||
        !getTricksterState(role, currentCamp)
      )
        return (
          ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction?.(
            role,
            request,
            pick,
            pickCamp,
            locale,
            world,
            currentCamp,
          ) ?? null
        );
      const targets = tricksterChoiceTargets(world, request.context.day);
      return targets.length >= 2
        ? {
            name: "swap_exile_targets",
            args: { first_id: targets[0]!, second_id: targets[1]!, abstain: false },
          }
        : { name: "swap_exile_targets", args: { first_id: null, second_id: null, abstain: true } };
    },
  },
  presentation: nativeRolePresentation("trickster"),
};
