import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { CUPID_POLICIES } from "../../../../core/domain/board";
import { Camp, Role, Phase, WinCondition } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";
import { getCupidState, projectCupidState } from "./state";
import { hasCupidNightCommit } from "./relation";
import { CUPID_STAGE } from "./night_stage";
const parameters = z.strictObject({
  policy: z.enum(CUPID_POLICIES).default("netease_2017_cupid_follows_lovers_v1"),
});
export const CUPID_ROLE_PROFILE: RoleProfile = {
  role: Role.Cupid,
  camp: Camp.Good,
  goodSide: "god",
  maxCount: 1,
  label: roleName("cupid"),
  skillBrief: text("zh-CN", "role.cupid.brief"),
  supportedWinConditions: [WinCondition.SlaughterCity],
  supportedBoardRoles: [
    Role.Cupid,
    Role.Wolf,
    Role.WolfKing,
    Role.WhiteWolfKing,
    Role.Seer,
    Role.Witch,
    Role.Guard,
    Role.Hunter,
    Role.Idiot,
    Role.Villager,
    Role.Knight,
    Role.Dreamer,
    Role.WolfBeauty,
  ],
  init: (role, ctx) => {
    if (!getCupidState(role))
      role.privateState.cupid = {
        policy: ctx.boardConfig?.cupid?.policy ?? "netease_2017_cupid_follows_lovers_v1",
        remaining: 1,
        choice: null,
      };
  },
  renderPrompt: (role, locale = "zh-CN") =>
    text(locale, "role.cupid.state") +
    " " +
    text(
      locale,
      getCupidState(role)?.policy === "lui_meme_lovers_only_v1"
        ? "role.cupid.lui"
        : "role.cupid.netease",
    ) +
    " " +
    text(locale, "role.cupid.status", {
      state: JSON.stringify(projectCupidState(getCupidState(role)!)),
    }),
  configuration: {
    schema: parameters,
    defaults: { policy: "netease_2017_cupid_follows_lovers_v1" },
    apply: (config, value) => ({ ...config, cupid: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.cupid ?? {}),
  },
  nightStages: [CUPID_STAGE],
  toolSpecs: [
    {
      name: "choose_lovers",
      parameters: {
        type: "object",
        properties: { first_id: { type: "integer" }, second_id: { type: "integer" } },
        required: ["first_id", "second_id"],
        additionalProperties: false,
      },
      argHint: 'choose_lovers args: {"first_id":number,"second_id":number}',
      userPromptHintKey: "action.choose_lovers.hint",
    },
  ],
  validationRules: {
    choose_lovers: ({ world, role, day, phase, toolCall }) => {
      const state = getCupidState(role);
      if (
        role.role !== Role.Cupid ||
        role.camp !== Camp.Good ||
        !state ||
        state.remaining !== 1 ||
        state.choice !== null ||
        day !== 1 ||
        hasCupidNightCommit(world, day)
      )
        return { code: RuleError.CupidUnavailable };
      if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
      if (toolCall.name !== "choose_lovers") return { code: RuleError.ToolMismatch };
      const { first_id, second_id } = toolCall.args;
      if (
        !Number.isSafeInteger(first_id) ||
        !Number.isSafeInteger(second_id) ||
        first_id === second_id ||
        !isAliveTarget(world, first_id) ||
        !isAliveTarget(world, second_id)
      )
        return { code: RuleError.CupidTarget };
      return null;
    },
  },
  baselineAction: (_role, request, _other, _camp, _locale, world) => {
    if (!request.allowedTools.includes("choose_lovers") || !world) return null;
    const ids = world.getAliveEntityIds();
    return ids.length < 2
      ? null
      : { name: "choose_lovers", args: { first_id: ids[0]!, second_id: ids[1]! } };
  },
  llmRepair: {
    coerce: {
      choose_lovers: (args) => {
        const first = numberOrNull(args.first_id),
          second = numberOrNull(args.second_id);
        return first === null || second === null ? null : { first_id: first, second_id: second };
      },
    },
  },
};
