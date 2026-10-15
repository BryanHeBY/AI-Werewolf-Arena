/**
 * 负责 白昼学者／寂夜导师 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 当前阵营通过调用方的晚读 source 传入；目录阵营仅为初值，不替代现场 Camp 或授予许可。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { ownRoleCallback, roleMethod } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules } from "../../engine/actions/validation-queries";

import { COMPONENT } from "../../domain/components/names";
import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { Role, Camp, WinCondition, Phase } from "../../domain/identity";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import {
  SCHOLAR_MENTOR_POLICY,
  initializeScholarMentorState,
  scholarMentorStateForRole,
} from "./state-slot";
import {
  scholarMentorChoicePending,
  scholarMentorChoiceTargets,
  scholarMentorRoleCanKnife,
  scholarMentorBonusTargets,
  captureScholarMentorBonus,
  isScholarMentorBoard,
} from "./night-frame";
import { SCHOLAR_MENTOR_NIGHT_STAGES } from "./night-stages";
const parameters = z.strictObject({
  policy: z.literal(SCHOLAR_MENTOR_POLICY).default(SCHOLAR_MENTOR_POLICY),
});
const supported = [
  Role.Wolf,
  Role.NightMentor,
  Role.Villager,
  Role.DayScholar,
  Role.Seer,
  Role.Witch,
  Role.Guard,
];
function profile(roleNameId: Role.DayScholar | Role.NightMentor): NativeRoleContributions {
  const mentor = roleNameId === Role.NightMentor;
  const base = mentor ? ORDINARY_WOLF_CONTRIBUTIONS : undefined;
  return {
    metadata: {
      ...base?.metadata,
      role: roleNameId,
      camp: mentor ? Camp.Wolf : Camp.Good,
      goodSide: mentor ? undefined : "god",
      maxCount: 1,
      supportedWinConditions: [WinCondition.SlaughterSide],
      supportedBoardRoles: supported,
      label: roleName(roleNameId),
      skillBrief: text("zh-CN", mentor ? "role.night_mentor.brief" : "role.day_scholar.brief"),
    },
    runtime: {
      ...base?.runtime,
      canSelfDestruct: false,
      wolfTeam: ownRoleCallback("wolfTeam", {
        wolfTeam: mentor
          ? (role, world) => ({
              recognizedByPack: true,
              recognizes: "none",
              canChat: false,
              canVoteForKill: scholarMentorRoleCanKnife(world, role),
            })
          : undefined,
      }),
      init: ownRoleCallback("init", {
        init: (role, ctx) => {
          parameters.parse(ctx.boardConfig?.scholarMentor ?? {});
          // 配置已原序 parse；privateState 左值仍先于 mentor 分支与状态工厂，不提前读取或复制。
          initializeScholarMentorState(
            () => role.privateState,
            () => (mentor ? "night_mentor" : "day_scholar"),
          );
        },
      }),
      configuration: {
        schema: parameters,
        defaults: parameters.parse({}),
        apply: (config, value) => ({ ...config, scholarMentor: parameters.parse(value) }),
        serialize: (config) => parameters.parse(config.scholarMentor ?? {}),
      },
      toolSpecs: [
        ...(base?.runtime.toolSpecs ?? []),
        {
          name: "modify_skill",
          parameters: {
            type: "object",
            properties: {
              mode: { type: ["string", "null"], enum: ["enhance", "weaken", null] },
              target_id: { type: ["integer", "null"], minimum: 1 },
            },
            required: ["mode", "target_id"],
            additionalProperties: false,
          },
          argHint: 'modify_skill args: {"mode":"enhance"|"weaken"|null,"target_id":number|null}',
          userPromptHintKey: "action.modify_skill.hint",
        },
        {
          name: "bonus_action",
          parameters: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["check", "guard", "poison", "kill"] },
              target_id: { type: ["integer", "null"], minimum: 1 },
              abstain: { type: "boolean" },
            },
            required: ["kind", "target_id", "abstain"],
            additionalProperties: false,
          },
          argHint:
            'bonus_action args: {"kind":"check"|"guard"|"poison"|"kill","target_id":number|null,"abstain":boolean}',
          userPromptHintKey: "action.bonus_action.hint",
        },
      ],
      stageDirectives: [
        ...(base?.runtime.stageDirectives ?? []),
        {
          match: (tools) => tools.length === 1 && tools[0] === "modify_skill",
          messageKey: "action.modify_skill.directive",
          text: text("zh-CN", "action.modify_skill.directive"),
        },
        {
          match: (tools) => tools.length === 1 && tools[0] === "bonus_action",
          messageKey: "action.bonus_action.directive",
          text: text("zh-CN", "action.bonus_action.directive"),
        },
      ],
      validationRules: ownedToolRules({
        ...base?.runtime.validationRules,
        modify_skill: ({ world, role, actorId, day, phase, toolCall }) => {
          const state = scholarMentorStateForRole(role, () =>
            world.getComponent(actorId, COMPONENT.Camp),
          );
          if (
            !state ||
            !isScholarMentorBoard(world) ||
            day === undefined ||
            phase !== Phase.Night ||
            toolCall.name !== "modify_skill" ||
            !scholarMentorChoicePending(world, day, actorId)
          )
            return { code: RuleError.ModifierUnavailable };
          const { mode, target_id } = toolCall.args;
          if (mode === null) return target_id === null ? null : { code: RuleError.ModifierTarget };
          return (mode === "enhance" || mode === "weaken") &&
            state.remaining[mode] === 1 &&
            target_id !== null &&
            scholarMentorChoiceTargets(world, day, actorId).includes(target_id)
            ? null
            : { code: RuleError.ModifierTarget };
        },
        bonus_action: ({ world, actorId, day, phase, toolCall }) => {
          if (
            !isScholarMentorBoard(world) ||
            day === undefined ||
            phase !== Phase.Night ||
            toolCall.name !== "bonus_action"
          )
            return { code: RuleError.ModifierUnavailable };
          const { kind, target_id, abstain } = toolCall.args;
          if (
            !["check", "guard", "poison", "kill"].includes(kind) ||
            typeof abstain !== "boolean" ||
            (abstain ? target_id !== null : target_id === null)
          )
            return { code: RuleError.ModifierTarget };
          try {
            captureScholarMentorBonus(world, day, actorId, kind, target_id);
            return null;
          } catch {
            return { code: RuleError.ModifierTarget };
          }
        },
      }),
      nightStages: [...SCHOLAR_MENTOR_NIGHT_STAGES, ...(base?.runtime.nightStages ?? [])],
      baselineAction: ownRoleCallback("baselineAction", {
        baselineAction: (role, request, pick, pickCamp, locale, world, currentCamp) => {
          if (request.allowedTools.includes("modify_skill") && world) {
            const state = scholarMentorStateForRole(role, currentCamp),
              targets = scholarMentorChoiceTargets(world, request.context.day, request.actorId);
            const mode =
              state?.remaining.enhance === 1
                ? "enhance"
                : state?.remaining.weaken === 1
                  ? "weaken"
                  : null;
            const target = targets.find((id) => id !== request.actorId) ?? targets[0] ?? null;
            return {
              name: "modify_skill",
              args: {
                mode: target === null ? null : mode,
                target_id: mode === null ? null : target,
              },
            };
          }
          if (
            request.allowedTools.includes("bonus_action") &&
            world &&
            request.context.modifier_bonus_kind
          ) {
            const kind = request.context.modifier_bonus_kind,
              target =
                scholarMentorBonusTargets(world, request.context.day, request.actorId, kind)[0] ??
                null;
            return {
              name: "bonus_action",
              args: { kind, target_id: target, abstain: target === null },
            };
          }
          return (
            roleMethod(base?.runtime, "baselineAction", base == null)?.(
              role,
              request,
              pick,
              pickCamp,
              locale,
              world,
              currentCamp,
            ) ?? null
          );
        },
      }),
    },
    presentation: nativeRolePresentation(roleNameId),
  };
}
export const SCHOLAR_ROLE_PROFILE = profile(Role.DayScholar);
export const MENTOR_ROLE_PROFILE = profile(Role.NightMentor);
