import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role, WinCondition } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
export const CURSED_FOX_GOAL = "netease_cursed_fox_last_faction_v1";
/** Sources and engineering completions: docs/expansion/rules/netease-cursed-fox-v1.md. */
export const CURSED_FOX_ROLE_PROFILE: RoleProfile = {
  role: Role.CursedFox,
  camp: Camp.ThirdParty,
  maxCount: 1,
  label: roleName("cursed_fox"),
  skillBrief: text("zh-CN", "role.cursed_fox.brief"),
  initialVictoryAffiliations: [{ kind: "individual", goalId: CURSED_FOX_GOAL }],
  inspectionLabels: { camp: Camp.Good },
  supportedWinConditions: [WinCondition.SlaughterCity],
  supportedBoardRoles: [
    Role.CursedFox,
    Role.Wolf,
    Role.WolfKing,
    Role.WhiteWolfKing,
    Role.HiddenWolf,
    Role.Seer,
    Role.Witch,
    Role.Guard,
    Role.Hunter,
    Role.Idiot,
    Role.Villager,
    Role.Knight,
    Role.Dreamer,
    Role.MiracleMerchant,
    Role.MirrorGirl,
  ],
  renderPrompt: (_role, locale = "zh-CN") => text(locale, "role.cursed_fox.state"),
  configuration: {
    schema: z.strictObject({}),
    defaults: {},
    apply: (config) => config,
    serialize: () => ({}),
  },
};
