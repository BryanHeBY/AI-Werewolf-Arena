/**
 * 负责 狼美人 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 * 行动规则在原资格／目标读取后的成功尾拒执行退休；初始化、baseline 与玩家知识不按该标记过滤。
 */
import { ownedToolRules, invokeValidationRule } from "../../engine/actions/validation-queries";

import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { z } from "zod";
import { BEAUTY_DEATH_LINK_POLICIES } from "../../domain/board";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Role, Camp, Phase } from "../../domain/model";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { getWolfBeautyState, setWolfBeautyState } from "./state";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { WOLF_VALIDATION_RULES } from "../wolf/ability-ports";
import { isAliveTarget } from "../../engine/actions/validation-contracts";
import { numberOrNull } from "../../agents/tool-repair/helpers";
import { WOLF_BEAUTY_CHARM_STAGE } from "./night-stages";
import { wolfBeautyDeathHook } from "./death-hook";
import { animalBeautyCharmAllowed, isAnimalDreamBoard } from "../animal-dream/beauty-query-ports";
import { animalBeautyKnowledge } from "../animal-dream/beauty-fact-ports";
import { COMPONENT } from "../../domain/components/names";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";

const parameters = z.strictObject({
  deathLinkPolicy: z.enum(BEAUTY_DEATH_LINK_POLICIES).default("awa_exile_poison_v1"),
});

export const WOLF_BEAUTY_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.WolfBeauty,
    label: roleName("wolf_beauty"),
    skillBrief: text("zh-CN", "role.wolf_beauty.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    canSelfDestruct: false,
    init: (role, ctx) => {
      setWolfBeautyState(role, {
        targetId: null,
        lastActedDay: null,
        history: [],
        ...(ctx.boardConfig?.wolfBeauty?.deathLinkPolicy &&
        ctx.boardConfig.wolfBeauty.deathLinkPolicy !== "awa_exile_poison_v1"
          ? { deathLinkPolicy: ctx.boardConfig.wolfBeauty.deathLinkPolicy }
          : {}),
      });
    },
    configuration: {
      schema: parameters,
      defaults: { deathLinkPolicy: "awa_exile_poison_v1" },
      apply: (config, value) => ({ ...config, wolfBeauty: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.wolfBeauty ?? {}),
    },
    nightStages: [...ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages!, WOLF_BEAUTY_CHARM_STAGE],
    deathHook: wolfBeautyDeathHook,
    toolSpecs: [
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs!.filter(
        (spec) => spec.name !== "self_destruct",
      ),
      {
        name: "charm",
        parameters: {
          type: "object",
          properties: { target_id: { type: ["number", "null"] } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'charm args: {"target_id":number|null}',
        userPromptHintKey: "action.charm.hint",
      },
    ],
    validationRules: ownedToolRules({
      ...WOLF_VALIDATION_RULES,
      kill_vote: (ctx) => {
        // 原表和 callee 仍在此处晚读；转发只按原 owner 关联 scope，未知替换规则只得到公开查询。
        const inherited = invokeValidationRule(
          WOLF_VALIDATION_RULES.kill_vote!,
          ctx,
          WOLF_VALIDATION_RULES,
        );
        if (inherited) return inherited;
        return ctx.toolCall.name === "kill_vote" &&
          !ctx.toolCall.args.abstain &&
          ctx.toolCall.args.target_id === ctx.actorId
          ? { code: RuleError.BeautySelfKnife }
          : null;
      },
      // 原状态／角色检查后才查询动物魅惑准入；它不等于已发表知识，也不跳过后续 phase／目标／连续夜校验。
      charm: ({ world, actorId, role, phase, day, toolCall }) => {
        const state = getWolfBeautyState(role);
        if (
          role.role !== Role.WolfBeauty ||
          world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Wolf ||
          !state ||
          !animalBeautyCharmAllowed(world, day ?? 0) ||
          state.lastActedDay === day
        )
          return { code: RuleError.CharmUnavailable };
        if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
        if (toolCall.name !== "charm") return { code: RuleError.ToolMismatch };
        if (toolCall.args.target_id === null)
          return isRoleExecutionRetired(role) ? { code: RuleError.CharmUnavailable } : null;
        if (toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id))
          return { code: RuleError.CharmTarget };
        const previous = state.history.at(-1);
        return previous?.day === (day ?? 1) - 1 && previous.targetId === toolCall.args.target_id
          ? { code: RuleError.CharmRepeat }
          : isRoleExecutionRetired(role)
            ? { code: RuleError.CharmUnavailable }
            : null;
      },
    }),
    llmRepair: {
      coerce: {
        ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.llmRepair?.coerce,
        charm: (args) => {
          if (args.target_id === null) return { target_id: null };
          const target = numberOrNull(args.target_id);
          return target === null ? null : { target_id: target };
        },
      },
    },
    baselineAction: (role, request, pick, byCamp, locale, _world, currentCamp) => {
      if (request.allowedTools.includes("charm")) {
        const target = pick(),
          previous = getWolfBeautyState(role)?.history.at(-1);
        return {
          name: "charm",
          args: {
            target_id:
              previous?.day === request.context.day - 1 && previous.targetId === target
                ? null
                : target,
          },
        };
      }
      return ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction!(
        role,
        request,
        pick,
        byCamp,
        locale,
        undefined,
        currentCamp,
      );
    },
  },
  presentation: nativeRolePresentation("wolf_beauty"),
};
