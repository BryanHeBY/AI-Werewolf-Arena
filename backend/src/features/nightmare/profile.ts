/**
 * 负责 噩梦之影 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 当前阵营通过调用方的晚读 source 传入；目录阵营仅为初值，不替代现场 Camp 或授予许可。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { ownedToolRules } from "../../engine/actions/validation-queries";

import { COMPONENT } from "../../domain/components/names";
import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { Role, WinCondition, Phase } from "../../domain/identity";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import {
  NIGHTMARE_SHADOW_POLICY,
  NIGHTMARE_SHADOW_STATE_SLOT,
  getNightmareShadowState,
} from "./state-slot";
import { nightmareFearTargets } from "./targets";
import { NIGHTMARE_FEAR_STAGE } from "./night-stages";
import { nightmarePackReady, nightmareFearPending } from "./night-frame";
const parameters = z.strictObject({
  policy: z.literal(NIGHTMARE_SHADOW_POLICY).default(NIGHTMARE_SHADOW_POLICY),
  fearActionPolicy: z.enum(["optional", "required_when_legal"]).default("optional"),
  wolfActionPolicy: z.enum(["standard", "no_blast_no_self_knife"]).default("standard"),
});
export const NIGHTMARE_SHADOW_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.NightmareShadow,
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.Wolf,
      Role.NightmareShadow,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Dreamer,
    ],
    label: roleName("nightmare"),
    skillBrief: text("zh-CN", "role.nightmare.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    canSelfDestruct: (role, currentCamp) =>
      getNightmareShadowState(role, currentCamp)?.wolfActionPolicy === "standard",
    wolfTeam: (role, world, currentCamp) => {
      const ready =
        !!getNightmareShadowState(role, currentCamp)?.packReady &&
        (!world || nightmarePackReady(world));
      return {
        recognizedByPack: ready,
        recognizes: ready ? "pack" : "none",
        canChat: ready,
        canVoteForKill: ready,
      };
    },
    init: (role, ctx) => {
      const value = parameters.parse(ctx.boardConfig?.nightmareShadow ?? {});
      NIGHTMARE_SHADOW_STATE_SLOT.install(() => role.privateState, value);
    },
    configuration: {
      schema: parameters,
      defaults: parameters.parse({}),
      apply: (config, value) => ({ ...config, nightmareShadow: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.nightmareShadow ?? {}),
    },
    toolSpecs: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs ?? []),
      {
        name: "fear",
        parameters: {
          type: "object",
          properties: {
            target_id: { type: ["integer", "null"], minimum: 1 },
            abstain: { type: "boolean" },
          },
          required: ["target_id", "abstain"],
          additionalProperties: false,
        },
        argHint: 'fear args: {"target_id":number|null,"abstain":true|false}',
        userPromptHintKey: "action.fear.hint",
      },
    ],
    stageDirectives: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "fear",
        messageKey: "action.fear.directive",
        text: text("zh-CN", "action.fear.directive"),
      },
    ],
    validationRules: ownedToolRules({
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      fear: ({ world, role, actorId, day, phase, toolCall }) => {
        const state = getNightmareShadowState(role, () =>
          world.getComponent(actorId, COMPONENT.Camp),
        );
        if (
          !state ||
          !nightmareFearPending(world, actorId, day ?? 0) ||
          phase !== Phase.Night ||
          toolCall.name !== "fear" ||
          day === undefined ||
          (state.lastDay !== null && state.lastDay >= day)
        )
          return { code: RuleError.NightmareUnavailable };
        const targets = nightmareFearTargets(world, actorId, day);
        if (toolCall.args.abstain)
          return toolCall.args.target_id === null &&
            (state.fearActionPolicy === "optional" || targets.length === 0)
            ? null
            : { code: RuleError.NightmareTarget };
        return toolCall.args.target_id !== null && targets.includes(toolCall.args.target_id)
          ? null
          : { code: RuleError.NightmareTarget };
      },
    }),
    nightStages: [NIGHTMARE_FEAR_STAGE, ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages ?? [])],
    baselineAction: (role, request, pick, pickCamp, locale, world, currentCamp) => {
      if (!request.allowedTools.includes("fear"))
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
      const target = world
        ? (nightmareFearTargets(world, request.actorId, request.context.day)[0] ?? null)
        : null;
      return { name: "fear", args: { target_id: target, abstain: target === null } };
    },
  },
  presentation: nativeRolePresentation("nightmare"),
};
