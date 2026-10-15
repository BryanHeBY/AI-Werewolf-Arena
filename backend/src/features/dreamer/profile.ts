/**
 * 负责 摄梦人 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { ownedToolRules } from "../../engine/actions/validation-queries";

import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { z } from "zod";
import { DREAM_PROTECTION_POLICIES } from "../../domain/board";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Camp, Role, Phase } from "../../domain/model";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { activeNightAbility } from "../night-abilities/inventory-ports";
import { getDreamerState, setDreamerState } from "./ports";
import { isAliveTarget } from "../../engine/actions/validation-contracts";
import { numberOrNull } from "../../agents/tool-repair/helpers";
import { DREAMER_NIGHT_STAGE } from "./night-stages";

const parameters = z.strictObject({
  protectionPolicy: z.enum(DREAM_PROTECTION_POLICIES).default("awa_night_damage_v1"),
});

export const DREAMER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Dreamer,
    camp: Camp.Good,
    goodSide: "god",
    label: roleName("dreamer"),
    skillBrief: text("zh-CN", "role.dreamer.brief"),
  },
  runtime: {
    init: (role, ctx) => {
      setDreamerState(role, {
        lastTarget: null,
        lastDay: null,
        history: [],
        ...(ctx.boardConfig?.dreamer?.protectionPolicy &&
        ctx.boardConfig.dreamer.protectionPolicy !== "awa_night_damage_v1"
          ? { protectionPolicy: ctx.boardConfig.dreamer.protectionPolicy }
          : {}),
      });
    },
    configuration: {
      schema: parameters,
      defaults: { protectionPolicy: "awa_night_damage_v1" },
      apply: (config, value) => ({ ...config, dreamer: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.dreamer ?? {}),
    },
    nightStages: [DREAMER_NIGHT_STAGE],
    toolSpecs: [
      {
        name: "dream",
        parameters: {
          type: "object",
          properties: { target_id: { type: "number" } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'dream args: {"target_id":number}',
        userPromptHintKey: "action.dream.hint",
      },
    ],
    validationRules: ownedToolRules({
      dream: ({ world, actorId, role, toolCall, phase, day, abilityId }) => {
        if (!activeNightAbility(role, "dream", day ?? 1, abilityId))
          return { code: RuleError.DreamUnavailable };
        if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
        if (
          toolCall.name !== "dream" ||
          toolCall.args.target_id === actorId ||
          !isAliveTarget(world, toolCall.args.target_id)
        )
          return { code: RuleError.DreamTarget };
        return null;
      },
    }),
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "dream",
        messageKey: "action.dream.directive",
        text: text("zh-CN", "action.dream.directive"),
      },
    ],
    llmRepair: {
      coerce: {
        dream: (args) => {
          const target = numberOrNull(args.target_id);
          return target === null ? null : { target_id: target };
        },
      },
    },
    baselineAction: (_role, request, pick) => {
      if (!request.allowedTools.includes("dream")) return null;
      const target = pick();
      return target === null ? null : { name: "dream", args: { target_id: target } };
    },
  },
  presentation: nativeRolePresentation("dreamer"),
};
