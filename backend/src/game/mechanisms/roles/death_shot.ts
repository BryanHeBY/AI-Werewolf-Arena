import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import { AliveComponent } from "../../../core/domain/components/alive";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import {
  DeathCause,
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
    llm: {
      name: "shoot",
      description: "Shoot a living target during an authorized death turn.",
      parameters: {
        type: "object",
        properties: {
          target_id: {
            type: ["number", "null"],
            description: "Target player number; null deliberately passes.",
          },
        },
        description: "Death-shot arguments.",
        required: ["target_id"],
        additionalProperties: false,
      },
    },
    argHint: 'shoot args: {"target_id":number|null}',
    userPromptHintKey: "action.shoot.hint",
    gatewaySchema: {
      name: "shoot",
      description: "One authorized death shot.",
      parameters: {
        type: "object",
        properties: { target_id: { type: ["number", "null"] } },
        required: ["target_id"],
      },
    },
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
  state: (role: RoleComponent) => { canShoot: boolean } | undefined;
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
    if (!state.canShoot || !rules.permits(sources)) {
      state.canShoot = false;
      continue;
    }
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
      !state.canShoot ||
      world.getComponent<AliveComponent>(actorId, COMPONENT.Alive)?.alive !== false
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
    if (context?.deferShotCommit) (result.pendingShots ??= []).push({ targetScope, event });
    else events.push(event);
  }
  return result;
}
