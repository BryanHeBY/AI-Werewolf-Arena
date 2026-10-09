import { aliveLifeVersion, type AliveComponent } from "../../../core/domain/components/alive";
import type { BadgeComponent } from "../../../core/domain/components/badge";
import type { RoleComponent } from "../../../core/domain/components/role";
import { COMPONENT } from "../../../core/domain/components/names";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import type { ActionProvider, EntityId, GameEvent, Phase } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import { GameActionRequestFactory } from "../../engine/action_request_factory";
import type { ToolGateway } from "../../gateway/tool_gateway";
import {
  badgeSuccessorEligible,
  commitSheriffBadgeChoice,
  transferOrDestroySheriffBadge,
} from "./badge";

/** A dead badge holder acts only inside an engine-owned, version-bound transient permit. */
export async function resolveSheriffBadge(
  world: World,
  fromId: EntityId,
  reason: string,
  events: GameEvent[],
  gateway: ToolGateway,
  provider: ActionProvider,
  phase: Phase,
  day: number,
  isCurrent: () => boolean,
): Promise<void> {
  if (!isCurrent()) return;
  const badge = world.getComponent<BadgeComponent>(fromId, COMPONENT.Badge);
  if (!badge?.isSheriff || badge.destroyed) return;
  if (badge.handoffPolicy !== "awa_holder_choice_v1") {
    transferOrDestroySheriffBadge(world, fromId, reason, events);
    return;
  }
  const life = world.getComponent<AliveComponent>(fromId, COMPONENT.Alive);
  const role = world.getComponent<RoleComponent>(fromId, COMPONENT.Role);
  const version = life && aliveLifeVersion(life);
  const weight = badge.voteWeight;
  const current = () =>
    isCurrent() &&
    world.getComponent(fromId, COMPONENT.Badge) === badge &&
    badge.isSheriff &&
    !badge.destroyed &&
    badge.handoffPolicy === "awa_holder_choice_v1" &&
    badge.voteWeight === weight &&
    world.getComponent(fromId, COMPONENT.Role) === role &&
    world.getComponent(fromId, COMPONENT.Alive) === life &&
    life?.alive === false &&
    aliveLifeVersion(life) === version;
  if (!life || !role || !current()) return;
  const candidates = world
    .getAliveEntityIds()
    .filter((id) => badgeSuccessorEligible(world, fromId, id));
  if (!candidates.length) {
    commitSheriffBadgeChoice(world, fromId, reason, events, null);
    return;
  }
  const scopes = new Map(candidates.map((id) => [id, captureNightLife(world, id)]));
  const permit = world.openDeathAction(fromId, "choose_badge_successor", phase, day, current);
  const authorized = () =>
    current() && world.hasDeathAction(fromId, "choose_badge_successor", phase, day, permit.id);
  try {
    if (!authorized()) return;
    const request = new GameActionRequestFactory(world, events, day).create({
      phase,
      actorId: fromId,
      allowedTools: ["choose_badge_successor"],
      stage: "sheriff_badge_choice",
      requiresAction: true,
      summary: { key: "request.summary.badge_choice" },
      context: {
        allow_fallback: false,
        trigger: "badge_handoff",
        death_action_id: permit.id,
        badge_candidates: candidates,
      },
    });
    if (!authorized()) return;
    const action = await provider.getAction(request);
    if (!authorized()) return;
    let target: EntityId | null = null;
    if (action?.name === "choose_badge_successor") {
      const checked = gateway.validateAndSanitize(world, fromId, action, {
        phase,
        day,
        deathActionId: permit.id,
        badgeCandidates: candidates,
      });
      if (!authorized()) return;
      if (checked.ok && checked.sanitizedCall) target = checked.sanitizedCall.args.target_id;
    }
    if (target !== null) {
      const scope = scopes.get(target);
      if (
        !scope ||
        !livingNightLife(world, scope) ||
        !badgeSuccessorEligible(world, fromId, target)
      )
        target = null;
    }
    if (authorized()) commitSheriffBadgeChoice(world, fromId, reason, events, target);
  } finally {
    permit.close();
  }
}
