import { z } from "zod";
import { GUARD_REPEAT_POLICIES } from "../../../../core/domain/board";
import { guardTargetRepeated } from "./repeat_policy";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：守卫角色 profile。 */
import { Camp, Role, Phase } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getGuardState, setGuardState } from "../private_state";
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
  renderPrompt: (roleComp, locale = "zh-CN") =>
    text(locale, "role.guard.state") +
    " " +
    text(
      locale,
      getGuardState(roleComp)?.repeatPolicy === "netease_consecutive_nights_v1"
        ? "role.guard.repeat_actual_nights"
        : "role.guard.repeat_last_action",
    ),
  toolSpecs: GUARD_TOOL_SPECS,
  validationRules: {
    guard: ({ world, actorId, role, toolCall, day, abilityId, phase }) => {
      const ability = activeNightAbility(role, "guard", day ?? 1, abilityId);
      if (!ability) return { code: RuleError.GuardOnly };
      if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
      if (toolCall.name !== "guard") return { code: RuleError.ToolMismatch };
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
