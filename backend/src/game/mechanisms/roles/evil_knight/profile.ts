import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, WinCondition } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { EVIL_KNIGHT_POLICY, freshEvilKnightState, getEvilKnightState } from "./state";
import { EVIL_KNIGHT_FRAME_STAGE } from "./night_frame";
const parameters = z.strictObject({
  policy: z.literal(EVIL_KNIGHT_POLICY).default(EVIL_KNIGHT_POLICY),
  shotPolicy: z.enum(["night_shot_immune", "hunter_shot_bypasses"]).default("night_shot_immune"),
});
export const EVIL_KNIGHT_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.EvilKnight,
  maxCount: 1,
  canSelfDestruct: false,
  toolSpecs: (WOLF_ROLE_PROFILE.toolSpecs ?? []).filter(
    (spec) => spec.name !== "self_destruct" && spec.name !== "self_destruct_with_target",
  ),
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.Wolf,
    Role.EvilKnight,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
  ],
  label: roleName("evil_knight"),
  skillBrief: text("zh-CN", "role.evil_knight.brief"),
  init: (role, ctx) => {
    role.privateState.evilKnight = freshEvilKnightState(
      parameters.parse(ctx.boardConfig?.evilKnight ?? {}).shotPolicy,
    );
  },
  renderPrompt: (role, locale = "zh-CN") => {
    const state = getEvilKnightState(role);
    return (
      text(locale, "role.evil_knight.state", { remaining: state?.reflectionRemaining ?? 0 }) +
      " " +
      text(
        locale,
        state?.shotPolicy === "hunter_shot_bypasses"
          ? "role.evil_knight.gun_bypasses"
          : "role.evil_knight.gun_immune",
      )
    );
  },
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, evilKnight: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.evilKnight ?? {}),
  },
  nightStages: [EVIL_KNIGHT_FRAME_STAGE, ...(WOLF_ROLE_PROFILE.nightStages ?? [])],
};
