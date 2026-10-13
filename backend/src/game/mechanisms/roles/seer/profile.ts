/**
 * 负责装配预言家的原生查验政策、初始化、工具与阶段贡献。输入为原板子参数、初始化组件、请求上下文与语言；输出保持既有 RoleProfile、提示和目标政策。状态引用和接受后的写入仍归具体机制 owner，本模块不创建第二仓库、授权 lease、执行伤害或编码归档。 注册的生产回退暂保留原特权 World 例外，观察输入迁移由 F01 独立实施。
 */
import { scholarMentorBlocks } from "../scholar_mentor/night_frame";
import { z } from "zod";
import {
  SEER_TARGET_POLICIES,
  SEER_ACTION_POLICIES,
  DEFAULT_SEER_ACTION_POLICY,
} from "../../../../core/domain/board";
import { seerTargetAllowed } from "./ports";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { roleName, text, term } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
/** 文件说明：预言家角色 profile。 */
import { Camp, Role, Phase } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getSeerState, setSeerState } from "./state";
import { numberOrNull } from "../../llm/helpers";
import { SEER_NIGHT_STAGES } from "./night_stages";
import { SEER_TOOL_SPECS } from "./tool_specs";
import { isAliveTarget } from "../../validation/contracts";
import { activeNightAbility } from "../abilities";
import { luckyTargetAllowed } from "../night_action_history";

const parameters = z.strictObject({
  targetPolicy: z.enum(SEER_TARGET_POLICIES).default("awa_alive_v1"),
  actionPolicy: z.enum(SEER_ACTION_POLICIES).default(DEFAULT_SEER_ACTION_POLICY),
});
/** 预言家角色配置。 */
export const SEER_ROLE_PROFILE: RoleProfile = {
  role: Role.Seer,
  camp: Camp.Good,
  label: roleName("seer"),
  skillBrief: text("zh-CN", "role.seer.brief"),
  goodSide: "god",
  configuration: {
    schema: parameters,
    defaults: { targetPolicy: "awa_alive_v1", actionPolicy: DEFAULT_SEER_ACTION_POLICY },
    apply: (config, value) => ({ ...config, seer: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.seer ?? {}),
  },
  init: (roleComp, ctx) => {
    setSeerState(roleComp, {
      lastTarget: null,
      lastIsWerewolf: null,
      lastResult: null,
      history: [],
      ...(ctx.boardConfig?.seer?.targetPolicy === "awa_fresh_others_v1"
        ? { targetPolicy: ctx.boardConfig.seer.targetPolicy }
        : {}),
      ...(ctx.boardConfig?.seer?.actionPolicy === "awa_optional_v1"
        ? { actionPolicy: ctx.boardConfig.seer.actionPolicy }
        : {}),
    });
  },
  renderPrompt: (roleComp, locale = "zh-CN") => {
    const state = getSeerState(roleComp);
    const latest =
      state && state.lastTarget !== null && (state.lastResult || state.lastIsWerewolf !== null)
        ? ` ${state.lastResult ? text(locale, "inspection.latest", { target: state.lastTarget, result: inspectionLabel(state.lastResult, locale) }) : text(locale, "role.seer.latest", { target: state.lastTarget, camp: term("camp", state.lastIsWerewolf ? "wolf" : "good", locale) })}`
        : "";
    return (
      text(locale, "role.seer.state") +
      latest +
      " " +
      text(
        locale,
        state?.targetPolicy === "awa_fresh_others_v1"
          ? "role.seer.targets_fresh"
          : "role.seer.targets_alive",
      ) +
      " " +
      text(
        locale,
        state?.actionPolicy !== "awa_optional_v1"
          ? "role.seer.action_required"
          : "role.seer.action_optional",
      )
    );
  },
  toolSpecs: SEER_TOOL_SPECS,
  validationRules: {
    check_identity: ({ world, actorId, role, toolCall, day, abilityId, phase }) => {
      const ability = activeNightAbility(role, "seer_check", day ?? 1, abilityId);
      if (!ability) return { code: RuleError.SeerOnly };
      if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
      if (toolCall.name !== "check_identity") return { code: RuleError.ToolMismatch };
      if (scholarMentorBlocks(world, day ?? 1, actorId, "check"))
        return { code: RuleError.ModifierUnavailable };
      if (!isAliveTarget(world, toolCall.args.target_id)) return { code: RuleError.CheckTarget };
      if (!seerTargetAllowed(ability.state, actorId, toolCall.args.target_id))
        return { code: RuleError.SeerTargetPolicy };
      if (!luckyTargetAllowed(world, actorId, ability, day ?? 1, "check", toolCall.args.target_id))
        return { code: RuleError.LuckyTargetRepeat };
      return null;
    },
  },
  nightStages: SEER_NIGHT_STAGES,
  llmRepair: {
    coerce: {
      check_identity: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target };
      },
    },
  },
  baselineAction: (roleComp, request, pickAliveNotSelf, _byCamp, _locale, world) => {
    if (!request.allowedTools.includes("check_identity")) {
      return null;
    }
    const ability = activeNightAbility(
      roleComp,
      "seer_check",
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
                seerTargetAllowed(ability.state, request.actorId, id) &&
                luckyTargetAllowed(
                  world,
                  request.actorId,
                  ability,
                  request.context.day,
                  "check",
                  id,
                ),
            ) ?? null)
        : pickAliveNotSelf();
    return target !== null ? { name: "check_identity", args: { target_id: target } } : null;
  },
};
