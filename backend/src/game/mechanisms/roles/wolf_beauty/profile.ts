import { z } from "zod";
import { BEAUTY_DEATH_LINK_POLICIES } from "../../../../core/domain/board";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Role, Camp, Phase } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getWolfBeautyState, setWolfBeautyState } from "../private_state";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { WOLF_VALIDATION_RULES } from "../wolf/validation_rules";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";
import { WOLF_BEAUTY_CHARM_STAGE } from "./night_stages";
import { wolfBeautyDeathHook } from "./death_hook";

const parameters = z.strictObject({
  deathLinkPolicy: z.enum(BEAUTY_DEATH_LINK_POLICIES).default("awa_exile_poison_v1"),
});

export const WOLF_BEAUTY_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.WolfBeauty,
  canSelfDestruct: false,
  label: roleName("wolf_beauty"),
  skillBrief: text("zh-CN", "role.wolf_beauty.brief"),
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
  renderPrompt: (role, locale = "zh-CN") => {
    const state = getWolfBeautyState(role);
    return (
      text(locale, "role.wolf_beauty.state") +
      " " +
      text(
        locale,
        state?.deathLinkPolicy === "heroes_s7_2017_exile_hunter_v1"
          ? "role.wolf_beauty.link_s7"
          : "role.wolf_beauty.link_awa",
      ) +
      " " +
      text(locale, "role.wolf_beauty.latest", {
        target: state?.targetId ?? text(locale, "common.none"),
        day: state?.lastActedDay ?? text(locale, "common.none"),
      })
    );
  },
  configuration: {
    schema: parameters,
    defaults: { deathLinkPolicy: "awa_exile_poison_v1" },
    apply: (config, value) => ({ ...config, wolfBeauty: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.wolfBeauty ?? {}),
  },
  nightStages: [...WOLF_ROLE_PROFILE.nightStages!, WOLF_BEAUTY_CHARM_STAGE],
  deathHook: wolfBeautyDeathHook,
  toolSpecs: [
    ...WOLF_ROLE_PROFILE.toolSpecs!.filter((spec) => spec.name !== "self_destruct"),
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
  validationRules: {
    ...WOLF_VALIDATION_RULES,
    kill_vote: (ctx) => {
      const inherited = WOLF_VALIDATION_RULES.kill_vote!(ctx);
      if (inherited) return inherited;
      return ctx.toolCall.name === "kill_vote" &&
        !ctx.toolCall.args.abstain &&
        ctx.toolCall.args.target_id === ctx.actorId
        ? { code: RuleError.BeautySelfKnife }
        : null;
    },
    charm: ({ world, actorId, role, phase, day, toolCall }) => {
      const state = getWolfBeautyState(role);
      if (
        role.role !== Role.WolfBeauty ||
        role.camp !== Camp.Wolf ||
        !state ||
        state.lastActedDay === day
      )
        return { code: RuleError.CharmUnavailable };
      if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
      if (toolCall.name !== "charm") return { code: RuleError.ToolMismatch };
      if (toolCall.args.target_id === null) return null;
      if (toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id))
        return { code: RuleError.CharmTarget };
      const previous = state.history.at(-1);
      return previous?.day === (day ?? 1) - 1 && previous.targetId === toolCall.args.target_id
        ? { code: RuleError.CharmRepeat }
        : null;
    },
  },
  llmRepair: {
    coerce: {
      ...WOLF_ROLE_PROFILE.llmRepair?.coerce,
      charm: (args) => {
        if (args.target_id === null) return { target_id: null };
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target };
      },
    },
  },
  baselineAction: (role, request, pick, byCamp, locale) => {
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
    return WOLF_ROLE_PROFILE.baselineAction!(role, request, pick, byCamp, locale);
  },
};
