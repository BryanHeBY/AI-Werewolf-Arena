import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, permitsDeathShot } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getWolfKingState, setWolfKingState } from "../private_state";
import { resolveDeathShots, DEATH_SHOT_TOOL_SPECS, DEATH_SHOT_REPAIR, validateDeathShot } from "../death_shot";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";

/** AWA wolf-king 1.0: normal pack permissions plus one cause-qualified death shot. */
export const WOLF_KING_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.WolfKing,
  label: roleName("wolf_king"), skillBrief: text("zh-CN", "role.wolf_king.brief"),
  init: role => { setWolfKingState(role, { canShoot: true }); },
  renderPrompt: (role, locale = "zh-CN") => text(locale, "role.wolf_king.state", { remaining: getWolfKingState(role)?.canShoot ? 1 : 0 }),
  toolSpecs: [...WOLF_ROLE_PROFILE.toolSpecs!, ...DEATH_SHOT_TOOL_SPECS],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    shoot: ctx => validateDeathShot(ctx, ctx.role.role === Role.WolfKing && getWolfKingState(ctx.role)?.canShoot === true),
  },
  llmRepair: { coerce: { ...WOLF_ROLE_PROFILE.llmRepair?.coerce, ...DEATH_SHOT_REPAIR.coerce } },
  deathHook: (world, ids, sources, choose, events) => resolveDeathShots(world, ids, sources, choose, events, {
    role: Role.WolfKing, state: getWolfKingState, permits: permitsDeathShot,
    shotEvent: (actorId, targetId) => ({ timestamp: Date.now(), type: "wolf_king_shot", payload: { actorId, targetId } }),
  }),
  baselineAction: (role, request, pickAliveNotSelf, pickAliveByCamp, locale) => request.allowedTools.includes("shoot")
    ? { name: "shoot", args: { target_id: pickAliveByCamp("good") ?? pickAliveNotSelf() } }
    : WOLF_ROLE_PROFILE.baselineAction!(role, request, pickAliveNotSelf, pickAliveByCamp, locale),
};
