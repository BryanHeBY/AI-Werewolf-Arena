import { redMoonVotedOutHook } from "./voted_out_hook";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, WinCondition } from "../../../../core/domain/identity";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { RED_MOON_POLICY, freshRedMoonState, getRedMoonState } from "./state";
const parameters = z.strictObject({
  policy: z.literal(RED_MOON_POLICY).default(RED_MOON_POLICY),
  lastWolfBlastPolicy: z.enum(["ends_game", "forbidden"]).default("ends_game"),
});
/** Finite runtime profile; full release validation is tracked in the Red Moon contract. */
export const RED_MOON_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.RedMoonApostle,
  maxCount: 1,
  votedOutHook: redMoonVotedOutHook,
  supportedWinConditions: [WinCondition.SlaughterSide],
  supportedBoardRoles: [
    Role.Wolf,
    Role.RedMoonApostle,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.DemonHunter,
    Role.Idiot,
  ],
  label: roleName("red_moon_apostle"),
  skillBrief: text("zh-CN", "role.red_moon_apostle.brief"),
  init: (role, ctx) => {
    role.privateState.redMoon = freshRedMoonState(
      parameters.parse(ctx.boardConfig?.redMoon ?? {}).lastWolfBlastPolicy,
    );
  },
  renderPrompt: (role, locale = "zh-CN") => {
    const state = getRedMoonState(role);
    return (
      text(locale, "role.red_moon_apostle.state", {
        blastDay: state?.blastDay ?? text(locale, "replay.none"),
        exileDay: state?.exileDay ?? text(locale, "replay.none"),
      }) +
      " " +
      text(
        locale,
        state?.lastWolfBlastPolicy === "forbidden"
          ? "role.red_moon_apostle.last_wolf_forbidden"
          : "role.red_moon_apostle.last_wolf_ends",
      )
    );
  },
  configuration: {
    schema: parameters,
    defaults: parameters.parse({}),
    apply: (config, value) => ({ ...config, redMoon: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.redMoon ?? {}),
  },
};
