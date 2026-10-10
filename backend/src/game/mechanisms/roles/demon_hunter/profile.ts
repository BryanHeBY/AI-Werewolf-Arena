import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, Camp, WinCondition } from "../../../../core/domain";
import type { RoleProfile } from "../contracts";
import { DEMON_HUNTER_POLICY, freshDemonHunterState } from "./state";
import { projectDemonHunter } from "./authority";
import { DEMON_HUNTER_TOOL_RULE } from "./validation_rules";
import { DEMON_HUNTER_NIGHT_STAGE } from "./night_stages";
const parameters = z.strictObject({
  policy: z.literal(DEMON_HUNTER_POLICY).default(DEMON_HUNTER_POLICY),
});
export const DEMON_HUNTER_ROLE_PROFILE: RoleProfile = {
  role: Role.DemonHunter,
  camp: Camp.Good,
  goodSide: "god",
  maxCount: 1,
  canSelfDestruct: false,
  supportedWinConditions: [WinCondition.SlaughterCity, WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.DemonHunter,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
  ],
  label: roleName("demon_hunter"),
  skillBrief: text("zh-CN", "role.demon_hunter.brief"),
  init: (role) => {
    role.privateState.demonHunter = freshDemonHunterState();
  },
  renderPrompt: (role, locale = "zh-CN", world) =>
    text(locale, "role.demon_hunter.state", {
      state: JSON.stringify(world ? projectDemonHunter(world, role) : undefined),
    }),
  configuration: {
    schema: parameters,
    defaults: { policy: DEMON_HUNTER_POLICY },
    apply: (config, value) => ({ ...config, demonHunter: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.demonHunter ?? {}),
  },
  toolSpecs: [
    {
      name: "demon_hunt",
      parameters: {
        type: "object",
        properties: {
          target_id: { type: ["integer", "null"], minimum: 1 },
          abstain: { type: "boolean" },
        },
        required: ["target_id", "abstain"],
        additionalProperties: false,
      },
      argHint: 'demon_hunt args: {"target_id":number|null,"abstain":boolean}',
      userPromptHintKey: "action.demon_hunt.hint",
    },
  ],
  validationRules: { demon_hunt: DEMON_HUNTER_TOOL_RULE },
  nightStages: [DEMON_HUNTER_NIGHT_STAGE],
  baselineAction: (_role, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("demon_hunt") || request.context.day < 2) return null;
    const target = pickAliveNotSelf();
    return { name: "demon_hunt", args: { target_id: target, abstain: target === null } };
  },
};
