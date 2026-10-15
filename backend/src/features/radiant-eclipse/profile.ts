/**
 * 负责 流光伯爵／蚀日侍女 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { ownedToolRules } from "../../engine/actions/validation-queries";

import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Phase, Role, WinCondition } from "../../domain/identity";
import type {
  NativeRoleContributions,
  RoleRuntimeContribution,
} from "../../rulesets/roles/contracts";
import {
  activeNightAbility,
  initializeNightAbilityInventory,
} from "../night-abilities/inventory-ports";
import { installNativeAbility } from "../night-abilities/native-installation-ports";
import { setNightAbilityStartDay } from "../night-abilities/inventory-ports";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { RADIANT_SHELTER_STAGE, ECLIPSE_SWALLOW_STAGE } from "./night-stages";
import { initializeEclipseState, RADIANT_ECLIPSE_POLICY } from "./eclipse-state-slot";
import { createShelterState } from "./shelter-state";
import {
  isRadiantEclipseBoard,
  captureRadiantTurn,
  eclipseChoiceEligible,
  shelterTargets,
  eclipseSwallowTargets,
  eclipseKnownWolves,
  eclipseKnifeEligible,
} from "./night-frame";
const parameters = z.strictObject({
  policy: z.literal(RADIANT_ECLIPSE_POLICY).default(RADIANT_ECLIPSE_POLICY),
});
const configuration: NonNullable<RoleRuntimeContribution["configuration"]> = {
  schema: parameters,
  defaults: parameters.parse({}),
  apply: (config, value) => ({ ...config, radiantEclipse: parameters.parse(value) }),
  serialize: (config) => parameters.parse(config.radiantEclipse ?? {}),
};
const common = {
  metadata: {
    maxCount: 1,
    supportedBoardRoles: [
      Role.Wolf,
      Role.EclipseMaid,
      Role.Villager,
      Role.RadiantCount,
      Role.Seer,
      Role.Witch,
      Role.Dreamer,
    ],
    supportedWinConditions: [WinCondition.SlaughterSide],
  },
  runtime: {
    canSelfDestruct: false,
    configuration,
  },
};
const targetParameters = {
  type: "object",
  properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
  required: ["target_id"],
  additionalProperties: false,
};
export const RADIANT_COUNT_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...common.metadata,
    role: Role.RadiantCount,
    camp: Camp.Good,
    goodSide: "god",
    label: roleName("radiant_count"),
    skillBrief: text("zh-CN", "role.radiant_count.brief"),
  },
  runtime: {
    ...common.runtime,
    init: (role) => {
      installNativeAbility(role, "shelter", createShelterState());
      setNightAbilityStartDay(activeNightAbility(role, "shelter", 1)!, 2);
    },
    nightStages: [RADIANT_SHELTER_STAGE],
    toolSpecs: [
      {
        name: "cast_shelter",
        parameters: targetParameters,
        argHint: 'cast_shelter args: {"target_id":number|null}',
        userPromptHintKey: "action.cast_shelter.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "cast_shelter",
        messageKey: "action.cast_shelter.directive",
        text: text("zh-CN", "action.cast_shelter.directive"),
      },
    ],
    validationRules: ownedToolRules({
      cast_shelter: ({ world, actorId, role, day, phase, abilityId, toolCall }) => {
        if (
          phase !== Phase.Night ||
          day === undefined ||
          !isRadiantEclipseBoard(world) ||
          toolCall.name !== "cast_shelter"
        )
          return { code: RuleError.RadiantShelterUnavailable };
        const a = activeNightAbility(role, "shelter", day, abilityId);
        if (!a) return { code: RuleError.RadiantShelterUnavailable };
        try {
          if (!captureRadiantTurn(world, actorId, a, day)())
            return { code: RuleError.RadiantShelterUnavailable };
        } catch {
          return { code: RuleError.RadiantShelterUnavailable };
        }
        return toolCall.args.target_id === null ||
          shelterTargets(world, day, actorId, a.id).includes(toolCall.args.target_id)
          ? null
          : { code: RuleError.RadiantShelterTarget };
      },
    }),
    baselineAction: (_role, request) =>
      request.allowedTools.includes("cast_shelter")
        ? { name: "cast_shelter", args: { target_id: null } }
        : null,
  },
  presentation: nativeRolePresentation("radiant_count"),
};
export const ECLIPSE_MAID_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    ...common.metadata,
    role: Role.EclipseMaid,
    camp: Camp.Wolf,
    label: roleName("eclipse_maid"),
    skillBrief: text("zh-CN", "role.eclipse_maid.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    ...common.runtime,
    init: (role) => {
      initializeEclipseState(role);
      initializeNightAbilityInventory(role);
    },
    wolfTeam: (_role, world) => ({
      recognizedByPack: false,
      recognizes: "none",
      canChat: false,
      canVoteForKill: !!world && eclipseKnifeEligible(world),
    }),
    knownTeammates: (_role, world) => eclipseKnownWolves(world),
    possibleNightAbilities: ["shelter", "dream", "potion", "seer_check"],
    nightStages: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages ?? []),
      ECLIPSE_SWALLOW_STAGE,
    ],
    toolSpecs: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs ?? []),
      {
        name: "swallow_skill",
        parameters: targetParameters,
        argHint: 'swallow_skill args: {"target_id":number|null}',
        userPromptHintKey: "action.swallow_skill.hint",
      },
    ],
    stageDirectives: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives ?? []),
      {
        match: (tools) => tools.length === 1 && tools[0] === "swallow_skill",
        messageKey: "action.swallow_skill.directive",
        text: text("zh-CN", "action.swallow_skill.directive"),
      },
    ],
    validationRules: ownedToolRules({
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      swallow_skill: ({ world, actorId, day, phase, toolCall }) => {
        if (
          phase !== Phase.Night ||
          day === undefined ||
          !isRadiantEclipseBoard(world) ||
          toolCall.name !== "swallow_skill"
        )
          return { code: RuleError.EclipseSwallowUnavailable };
        if (!eclipseChoiceEligible(world, day, actorId))
          return { code: RuleError.EclipseSwallowUnavailable };
        return toolCall.args.target_id === null ||
          eclipseSwallowTargets(world, day).includes(toolCall.args.target_id)
          ? null
          : { code: RuleError.EclipseSwallowTarget };
      },
    }),
    baselineAction: (role, request, ...rest) =>
      request.allowedTools.includes("swallow_skill")
        ? { name: "swallow_skill", args: { target_id: null } }
        : (ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction?.(role, request, ...rest) ?? null),
  },
  presentation: nativeRolePresentation("eclipse_maid"),
};
