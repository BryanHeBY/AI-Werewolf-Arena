import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { VictoryComponent } from "../../../../core/domain/components/victory";
import { Camp, Role, Phase } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";
import { canChooseExemplar, freshHybridState, getHybridState, projectHybridState } from "./state";
import { HYBRID_STAGE } from "./night_stage";

export const HYBRID_ROLE_PROFILE: RoleProfile = {
  role: Role.Hybrid,
  camp: Camp.Good,
  goodSide: "villager",
  maxCount: 1,
  initialVictoryAffiliations: [],
  label: roleName("hybrid"),
  skillBrief: text("zh-CN", "role.hybrid.brief"),
  supportedBoardRoles: [
    Role.Hybrid,
    Role.Wolf,
    Role.WolfKing,
    Role.HiddenWolf,
    Role.Seer,
    Role.Witch,
    Role.Guard,
    Role.Hunter,
    Role.Idiot,
    Role.Villager,
  ],
  init: (role) => {
    if (!getHybridState(role)) role.privateState.hybrid = freshHybridState();
  },
  renderPrompt: (role, locale = "zh-CN") =>
    text(locale, "role.hybrid.state") +
    " " +
    text(locale, "role.hybrid.status", {
      state: JSON.stringify(projectHybridState(getHybridState(role)!)),
    }),
  configuration: {
    schema: z.strictObject({}),
    defaults: {},
    apply: (config) => config,
    serialize: () => ({}),
  },
  nightStages: [HYBRID_STAGE],
  toolSpecs: [
    {
      name: "choose_exemplar",
      parameters: {
        type: "object",
        properties: { target_id: { type: "integer" } },
        required: ["target_id"],
        additionalProperties: false,
      },
      argHint: 'choose_exemplar args: {"target_id":number}',
      userPromptHintKey: "action.choose_exemplar.hint",
    },
  ],
  validationRules: {
    choose_exemplar: ({ world, actorId, role, day, phase, toolCall }) => {
      const state = getHybridState(role),
        victory = world.getComponent<VictoryComponent>(actorId, COMPONENT.Victory);
      if (
        role.role !== Role.Hybrid ||
        role.camp !== Camp.Good ||
        !state ||
        day === undefined ||
        !canChooseExemplar(state, day) ||
        !victory ||
        victory.affiliations.length !== 0
      )
        return { code: RuleError.HybridUnavailable };
      if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
      if (toolCall.name !== "choose_exemplar") return { code: RuleError.ToolMismatch };
      if (toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id))
        return { code: RuleError.HybridTarget };
      return null;
    },
  },
  llmRepair: {
    coerce: {
      choose_exemplar: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target };
      },
    },
  },
};
