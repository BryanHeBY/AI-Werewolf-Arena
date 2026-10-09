import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import {
  COMPONENT,
  Role,
  Camp,
  Phase,
  DEBATER_POLICIES,
  type RoleComponent,
} from "../../../../core/domain";
import type { RoleProfile } from "../contracts";
import { numberOrNull } from "../../llm/helpers";
import { getDebaterState, projectDebaterState } from "./state";
import { debateAuthority, hasDebateCommit, sameDebateParticipant } from "./authority";
const parameters = z.strictObject({
  policy: z.enum(DEBATER_POLICIES).default("awa_melbourne_2026_speech_gap_v1"),
});
export const DEBATER_ROLE_PROFILE: RoleProfile = {
  role: Role.Debater,
  camp: Camp.Good,
  goodSide: "god",
  maxCount: 1,
  label: roleName("debater"),
  skillBrief: text("zh-CN", "role.debater.brief"),
  supportedBoardRoles: [
    Role.Debater,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Idiot,
    Role.WolfKing,
    Role.WhiteWolfKing,
    Role.Knight,
  ],
  init: (role, ctx) => {
    if (!getDebaterState(role))
      role.privateState.debater = {
        policy: ctx.boardConfig?.debater?.policy ?? "awa_melbourne_2026_speech_gap_v1",
        remaining: 1,
        choice: null,
      };
  },
  renderPrompt: (role, locale = "zh-CN", world) => {
    const actor = world
      ?.getEntityIdsByRole(Role.Debater)
      .find((id) => world.getComponent(id, COMPONENT.Role) === role);
    return (
      text(locale, "role.debater.state") +
      " " +
      text(locale, "role.debater.status", {
        state: JSON.stringify(
          projectDebaterState(
            getDebaterState(role)!,
            !!world && actor !== undefined && hasDebateCommit(world, actor),
          ),
        ),
      })
    );
  },
  configuration: {
    schema: parameters,
    defaults: { policy: "awa_melbourne_2026_speech_gap_v1" },
    apply: (config, value) => ({ ...config, debater: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.debater ?? {}),
  },
  toolSpecs: [
    {
      name: "challenge",
      parameters: {
        type: "object",
        properties: { target_id: { type: "integer" } },
        required: ["target_id"],
        additionalProperties: false,
      },
      argHint: 'challenge args: {"target_id":number}',
      userPromptHintKey: "action.challenge.hint",
    },
  ],
  validationRules: {
    challenge: ({ world, actorId, day, phase, toolCall, debateId }) => {
      const a = debateAuthority(world, debateId),
        role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role),
        state = getDebaterState(role);
      if (toolCall.name !== "challenge") return { code: RuleError.ToolMismatch };
      if (
        role?.role !== Role.Debater ||
        role.camp !== Camp.Good ||
        !a ||
        a.stage !== "challenge" ||
        a.actorId !== actorId ||
        a.day !== day ||
        phase !== Phase.Day ||
        !state ||
        state.remaining !== 1 ||
        state.choice !== null ||
        hasDebateCommit(world, actorId)
      )
        return { code: RuleError.DebateUnavailable };
      if (
        toolCall.args.target_id !== a.targetId ||
        actorId === a.targetId ||
        !a.participants.has(actorId) ||
        !a.participants.has(a.targetId) ||
        !sameDebateParticipant(world, a.participants.get(actorId)!) ||
        !sameDebateParticipant(world, a.participants.get(a.targetId)!)
      )
        return { code: RuleError.DebateTarget };
      return null;
    },
  },
  baselineAction: (_role, request) =>
    request.allowedTools.includes("challenge") && request.context.debate_target_id !== undefined
      ? { name: "challenge", args: { target_id: request.context.debate_target_id } }
      : null,
  llmRepair: {
    coerce: {
      challenge: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target };
      },
    },
  },
};
