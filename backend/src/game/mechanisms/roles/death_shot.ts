import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import { AliveComponent, aliveLifeVersion } from "../../../core/domain/components/alive";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import {
  DeathCause,
  permitsDeathShot,
  type DeathActionPolicy,
  type EntityId,
  type GameEvent,
  type Role,
  type DeathSources,
  type DeathShotSelection,
} from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { DeathHookResult, DeathHookContext } from "../hooks/hook_registry";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import type { ToolSpec } from "../contracts";
import type { ToolRepairPack } from "../llm/contracts";
import { numberOrNull } from "../llm/helpers";
import { isAliveTarget, type ValidationRuleContext } from "../validation/contracts";

/** Native metadata is role-neutral; SDK/MCP prose and player hints are localized. */
export const DEATH_SHOT_TOOL_SPECS: ToolSpec[] = [
  {
    name: "shoot",
    parameters: {
      type: "object",
      properties: {
        target_id: {
          type: ["number", "null"],
        },
      },
      required: ["target_id"],
      additionalProperties: false,
    },
    argHint: 'shoot args: {"target_id":number|null}',
    userPromptHintKey: "action.shoot.hint",
  },
];
export const DEATH_SHOT_REPAIR: ToolRepairPack = {
  coerce: {
    shoot: (args) => {
      if (args.target_id === null) return { target_id: null };
      const target = numberOrNull(args.target_id);
      return target === null ? null : { target_id: target };
    },
  },
};
export function validateDeathShot(ctx: ValidationRuleContext, hasShot: boolean) {
  if (!hasShot) return { code: RuleError.ShootUnavailable };
  if (ctx.toolCall.name !== "shoot") return { code: RuleError.ToolMismatch };
  if (
    ctx.toolCall.args.target_id !== null &&
    !isAliveTarget(ctx.world, ctx.toolCall.args.target_id)
  )
    return { code: RuleError.ShootTarget };
  return null;
}

interface DeathShotRules {
  role: Role;
  state: (
    role: RoleComponent,
  ) => { canShoot: boolean; deathActionPolicy?: DeathActionPolicy } | undefined;
  policy?: (state: {
    canShoot: boolean;
    deathActionPolicy?: DeathActionPolicy;
  }) => DeathActionPolicy;
  permits: (sources: readonly DeathCause[]) => boolean;
  shotEvent: (actorId: EntityId, targetId: EntityId) => GameEvent;
  poisonEvent?: (actorId: EntityId) => GameEvent;
}

/** Shared single-shot consumption; the central resolver owns actual deaths and victory. */
export async function resolveDeathShots(
  world: World,
  deadIds: EntityId[],
  deathSources: DeathSources,
  choose: (actorId: EntityId) => Promise<DeathShotSelection>,
  events: GameEvent[],
  rules: DeathShotRules,
  context?: DeathHookContext,
): Promise<DeathHookResult> {
  const result: DeathHookResult = { extraDeaths: [], extraDeathSources: {} };
  for (const actorId of deadIds) {
    if (context?.isCurrent && !context.isCurrent()) break;
    const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
    const state = role ? rules.state(role) : undefined;
    if (
      !role ||
      role.role !== rules.role ||
      !state ||
      world.getComponent<AliveComponent>(actorId, COMPONENT.Alive)?.alive !== false
    )
      continue;
    const sources = deathSources[actorId] ?? [];
    if (sources.includes(DeathCause.Poison)) {
      state.canShoot = false;
      if (rules.poisonEvent) events.push(rules.poisonEvent(actorId));
      continue;
    }
    const policy = rules.policy?.(state);
    const causeIdentity = JSON.stringify(sources);
    if (
      !state.canShoot ||
      !rules.permits(sources) ||
      (policy !== undefined && !permitsDeathShot(sources, policy))
    ) {
      state.canShoot = false;
      continue;
    }
    const actorLife = world.getComponent<AliveComponent>(actorId, COMPONENT.Alive)!;
    const actorVersion = aliveLifeVersion(actorLife);
    const camp = role.camp,
      privateState = role.privateState;
    const targets = new Map(
      world.getAliveEntityIds().map((id) => [id, captureNightLife(world, id)]),
    );
    const selected = await choose(actorId);
    if (context?.isCurrent && !context.isCurrent()) break;
    const currentRole = world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
    if (
      currentRole !== role ||
      currentRole.role !== rules.role ||
      currentRole.camp !== camp ||
      currentRole.privateState !== privateState ||
      rules.state(currentRole) !== state ||
      rules.policy?.(state) !== policy ||
      JSON.stringify(deathSources[actorId] ?? []) !== causeIdentity ||
      !rules.permits(deathSources[actorId] ?? []) ||
      (policy !== undefined && !permitsDeathShot(deathSources[actorId] ?? [], policy)) ||
      !state.canShoot ||
      world.getComponent(actorId, COMPONENT.Alive) !== actorLife ||
      actorLife.alive ||
      aliveLifeVersion(actorLife) !== actorVersion
    )
      continue;
    if (
      selected.kind === "invalid" ||
      !world.isDeathActionOpen(actorId, "shoot", selected.deathActionId)
    )
      continue;
    if (selected.kind === "pass") {
      state.canShoot = false;
      continue;
    }
    const targetScope = selected.targetScope ?? targets.get(selected.targetId);
    if (
      !targetScope ||
      targetScope.id !== selected.targetId ||
      !livingNightLife(world, targetScope)
    )
      continue;
    state.canShoot = false;
    if (context?.nightEffect && context.blocksNightShot(selected.targetId)) {
      events.push({
        timestamp: Date.now(),
        type: "death_shot_blocked",
        payload: { actorId, targetId: selected.targetId, reason: "night_protection" },
      });
      continue;
    }
    result.extraDeaths.push(selected.targetId);
    if (context?.nightEffect) (result.nightEffectTargets ??= []).push(selected.targetId);
    result.extraDeathSources[selected.targetId] = [DeathCause.Shot];
    const event = rules.shotEvent(actorId, selected.targetId);
    if (context?.deferShotCommit)
      (result.pendingShots ??= []).push({
        targetScope,
        event,
        isCurrent: () =>
          (context.isCurrent?.() ?? true) &&
          world.getComponent(actorId, COMPONENT.Role) === role &&
          role.role === rules.role &&
          role.camp === camp &&
          role.privateState === privateState &&
          rules.state(role) === state &&
          rules.policy?.(state) === policy &&
          world.getComponent(actorId, COMPONENT.Alive) === actorLife &&
          !actorLife.alive &&
          aliveLifeVersion(actorLife) === actorVersion &&
          JSON.stringify(deathSources[actorId] ?? []) === causeIdentity &&
          world.isDeathActionOpen(actorId, "shoot", selected.deathActionId),
      });
    else events.push(event);
  }
  return result;
}
