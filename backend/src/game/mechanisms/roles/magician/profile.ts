import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Role, Camp, WinCondition, Phase } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { MAGICIAN_POLICY, createMagicianState, getMagicianState } from "./state";
import { magicianChoicePending, magicianChoiceTargets } from "./night_frame";
import { MAGICIAN_EXCHANGE_STAGE } from "./night_stages";
const parameters = z.strictObject({
  policy: z.literal(MAGICIAN_POLICY).default(MAGICIAN_POLICY),
  firstNight: z.union([z.literal(1), z.literal(2)]).default(1),
  deathShotTargetPolicy: z.enum(["original", "exchanged"]).default("original"),
});
export const MAGICIAN_ROLE_PROFILE: RoleProfile = {
  role: Role.Magician,
  camp: Camp.Good,
  goodSide: "god",
  maxCount: 1,
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.WolfSorcerer,
    Role.Psychic,
    Role.Trickster,
    Role.OrderPrince,
    Role.Wolf,
    Role.WolfKing,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Magician,
  ],
  label: roleName("magician"),
  skillBrief: text("zh-CN", "role.magician.brief"),
  init: (role, ctx) => {
    const value = parameters.parse(ctx.boardConfig?.magician ?? {});
    role.privateState.magician = createMagicianState(value.firstNight, value.deathShotTargetPolicy);
  },
  renderPrompt: (role, locale = "zh-CN") => {
    const state = getMagicianState(role);
    return [
      text(locale, "role.magician.brief"),
      text(locale, "role.magician.trickster_rule"),
      text(locale, "role.magician.sorcerer_rule"),
      text(locale, "role.magician.heal_rule"),
      text(locale, "role.magician.first_night", { day: state?.firstNight ?? 1 }),
      text(
        locale,
        state?.deathShotTargetPolicy === "exchanged"
          ? "role.magician.shots_exchanged"
          : "role.magician.shots_original",
      ),
    ].join(" ");
  },
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, magician: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.magician ?? {}),
  },
  toolSpecs: [
    {
      name: "swap_targets",
      parameters: {
        type: "object",
        properties: {
          first_id: { type: ["integer", "null"], minimum: 1 },
          second_id: { type: ["integer", "null"], minimum: 1 },
          abstain: { type: "boolean" },
        },
        required: ["first_id", "second_id", "abstain"],
        additionalProperties: false,
      },
      argHint:
        'swap_targets args: {"first_id":number|null,"second_id":number|null,"abstain":true|false}',
      userPromptHintKey: "action.swap_targets.hint",
    },
  ],
  stageDirectives: [
    {
      match: (tools) => tools.length === 1 && tools[0] === "swap_targets",
      messageKey: "action.swap_targets.directive",
      text: text("zh-CN", "action.swap_targets.directive"),
    },
  ],
  validationRules: {
    swap_targets: ({ world, role, actorId, day, phase, toolCall }) => {
      if (
        !getMagicianState(role) ||
        day === undefined ||
        phase !== Phase.Night ||
        toolCall.name !== "swap_targets" ||
        !magicianChoicePending(world, actorId, day)
      )
        return { code: RuleError.MagicianUnavailable };
      const { first_id, second_id, abstain } = toolCall.args;
      if (abstain)
        return first_id === null && second_id === null ? null : { code: RuleError.MagicianTarget };
      const targets = magicianChoiceTargets(world, day);
      return first_id !== null &&
        second_id !== null &&
        first_id !== second_id &&
        targets.includes(first_id) &&
        targets.includes(second_id)
        ? null
        : { code: RuleError.MagicianTarget };
    },
  },
  nightStages: [MAGICIAN_EXCHANGE_STAGE],
  baselineAction: (role, request, _pick, _pickCamp, _locale, world) => {
    if (!request.allowedTools.includes("swap_targets") || !world || !getMagicianState(role))
      return null;
    const targets = magicianChoiceTargets(world, request.context.day);
    return targets.length >= 2
      ? {
          name: "swap_targets",
          args: { first_id: targets[0]!, second_id: targets[1]!, abstain: false },
        }
      : { name: "swap_targets", args: { first_id: null, second_id: null, abstain: true } };
  },
};
