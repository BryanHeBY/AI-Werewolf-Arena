/**
 * 负责 守卫 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { scholarMentorBlocks } from "../scholar_mentor/night_frame";
import { z } from "zod";
import { GUARD_REPEAT_POLICIES } from "../../../../core/domain/board";
import { guardTargetRepeated } from "./ports";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：守卫角色 profile。 */
import { Camp, Role, Phase } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getGuardState, setGuardState } from "./state";
import { numberOrNull } from "../../llm/helpers";
import { GUARD_NIGHT_STAGES } from "./night_stages";
import { GUARD_TOOL_SPECS } from "./tool_specs";
import { isAliveTarget } from "../../validation/contracts";
import { activeNightAbility } from "../abilities";
import { luckyTargetAllowed } from "../night_action_history";

const parameters = z.strictObject({
  repeatPolicy: z.enum(GUARD_REPEAT_POLICIES).default("awa_last_action_v1"),
});

/** 守卫角色配置。 */
export const GUARD_ROLE_PROFILE: RoleProfile = {
  role: Role.Guard,
  camp: Camp.Good,
  label: roleName("guard"),
  skillBrief: text("zh-CN", "role.guard.brief"),
  goodSide: "god",
  configuration: {
    schema: parameters,
    defaults: { repeatPolicy: "awa_last_action_v1" },
    apply: (config, value) => ({ ...config, guard: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.guard ?? {}),
  },
  init: (roleComp, ctx) => {
    setGuardState(roleComp, {
      lastTarget: null,
      ...(ctx.boardConfig?.guard?.repeatPolicy === "netease_consecutive_nights_v1"
        ? { repeatPolicy: ctx.boardConfig.guard.repeatPolicy }
        : {}),
    });
  },
  ...nativeRolePresentation("guard"),
  toolSpecs: GUARD_TOOL_SPECS,
  validationRules: {
    guard: ({ world, actorId, role, toolCall, day, abilityId, phase }) => {
      const ability = activeNightAbility(role, "guard", day ?? 1, abilityId);
      if (!ability) return { code: RuleError.GuardOnly };
      if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
      if (toolCall.name !== "guard") return { code: RuleError.ToolMismatch };
      if (scholarMentorBlocks(world, day ?? 1, actorId, "guard"))
        return { code: RuleError.ModifierUnavailable };
      if (toolCall.args.abstain) return null;
      if (toolCall.args.target_id === null) return { code: RuleError.GuardTarget };
      if (guardTargetRepeated(ability, day ?? 1, toolCall.args.target_id))
        return { code: RuleError.GuardRepeat };
      if (!isAliveTarget(world, toolCall.args.target_id)) return { code: RuleError.GuardTarget };
      if (!luckyTargetAllowed(world, actorId, ability, day ?? 1, "guard", toolCall.args.target_id))
        return { code: RuleError.LuckyTargetRepeat };
      return null;
    },
  },
  nightStages: GUARD_NIGHT_STAGES,
  llmRepair: {
    coerce: {
      guard: (args) => {
        const abstain = Boolean(args.abstain);
        if (abstain) return { target_id: null, abstain: true };
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target, abstain: false };
      },
    },
  },
  baselineAction: (roleComp, request, pickAliveNotSelf, _byCamp, _locale, world) => {
    if (!request.allowedTools.includes("guard")) {
      return null;
    }
    const ability = activeNightAbility(
      roleComp,
      "guard",
      request.context.day,
      request.context.ability_id,
    );
    const target =
      world && ability
        ? (world
            .getAliveEntityIds()
            .find(
              (id) =>
                id !== request.actorId &&
                !guardTargetRepeated(ability, request.context.day, id) &&
                luckyTargetAllowed(
                  world,
                  request.actorId,
                  ability,
                  request.context.day,
                  "guard",
                  id,
                ),
            ) ?? null)
        : pickAliveNotSelf();
    if (target !== null && ability && !guardTargetRepeated(ability, request.context.day, target)) {
      return { name: "guard", args: { target_id: target, abstain: false } };
    }
    return { name: "guard", args: { target_id: null, abstain: true } };
  },
};
