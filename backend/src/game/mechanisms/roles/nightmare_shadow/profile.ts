import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, WinCondition, Phase } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import {
  NIGHTMARE_SHADOW_POLICY,
  freshNightmareShadowState,
  getNightmareShadowState,
  nightmareFearTargets,
} from "./state";
import { NIGHTMARE_FEAR_STAGE } from "./night_stages";
import { nightmarePackReady, nightmareFearPending } from "./night_frame";
const parameters = z.strictObject({
  policy: z.literal(NIGHTMARE_SHADOW_POLICY).default(NIGHTMARE_SHADOW_POLICY),
  fearActionPolicy: z.enum(["optional", "required_when_legal"]).default("optional"),
  wolfActionPolicy: z.enum(["standard", "no_blast_no_self_knife"]).default("standard"),
});
export const NIGHTMARE_SHADOW_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.NightmareShadow,
  maxCount: 1,
  canSelfDestruct: (role) => getNightmareShadowState(role)?.wolfActionPolicy === "standard",
  wolfTeam: (role, world) => {
    const ready =
      !!getNightmareShadowState(role)?.packReady && (!world || nightmarePackReady(world));
    return {
      recognizedByPack: ready,
      recognizes: ready ? "pack" : "none",
      canChat: ready,
      canVoteForKill: ready,
    };
  },
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
  init: (role, ctx) => {
    const value = parameters.parse(ctx.boardConfig?.nightmareShadow ?? {});
    role.privateState.nightmareShadow = freshNightmareShadowState(
      value.fearActionPolicy,
      value.wolfActionPolicy,
    );
  },
  renderPrompt: (role, locale = "zh-CN") => {
    const state = getNightmareShadowState(role);
    return [
      text(locale, "role.nightmare.state"),
      text(
        locale,
        state?.fearActionPolicy === "required_when_legal"
          ? "role.nightmare.required"
          : "role.nightmare.optional",
      ),
      text(
        locale,
        state?.wolfActionPolicy === "standard"
          ? "role.nightmare.standard"
          : "role.nightmare.no_blast",
      ),
    ].join(" ");
  },
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, nightmareShadow: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.nightmareShadow ?? {}),
  },
  toolSpecs: [
    ...(WOLF_ROLE_PROFILE.toolSpecs ?? []),
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
    ...(WOLF_ROLE_PROFILE.stageDirectives ?? []),
    {
      match: (tools) => tools.length === 1 && tools[0] === "fear",
      messageKey: "action.fear.directive",
      text: text("zh-CN", "action.fear.directive"),
    },
  ],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    fear: ({ world, role, actorId, day, phase, toolCall }) => {
      const state = getNightmareShadowState(role);
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
  },
  nightStages: [NIGHTMARE_FEAR_STAGE, ...(WOLF_ROLE_PROFILE.nightStages ?? [])],
  baselineAction: (role, request, pick, pickCamp, locale, world) => {
    if (!request.allowedTools.includes("fear"))
      return (
        WOLF_ROLE_PROFILE.baselineAction?.(role, request, pick, pickCamp, locale, world) ?? null
      );
    const target = world
      ? (nightmareFearTargets(world, request.actorId, request.context.day)[0] ?? null)
      : null;
    return { name: "fear", args: { target_id: target, abstain: target === null } };
  },
};
