/**
 * 负责死亡枪工具定义、校验、原单枪消费与追加死亡提案。输入为死亡上下文、当前枪权和选择，输出为校验结果及带原生命的追加提案。
 * 预检不付款，角色死亡流程复验后消费；目标死亡与最终判胜仍由有序中央结算负责。
 */
import { openDemonHunterStockFrame } from "./demon_hunter/authority";
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
import { RuleError } from "@ai-werewolf-arena/game-contract";
import type { ToolSpec } from "../contracts";
import type { ToolRepairPack } from "../llm/contracts";
import { numberOrNull } from "../llm/helpers";
import { isAliveTarget, type ValidationRuleContext } from "../validation/contracts";

/** 原生工具元数据不绑定特定角色；SDK／MCP 文案与玩家提示由本地化入口提供。 */
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
  ) => { readonly canShoot: boolean; readonly deathActionPolicy?: DeathActionPolicy } | undefined;
  policy?: (state: {
    readonly canShoot: boolean;
    readonly deathActionPolicy?: DeathActionPolicy;
  }) => DeathActionPolicy;
  permits: (sources: readonly DeathCause[]) => boolean;
  shotEvent: (actorId: EntityId, targetId: EntityId) => GameEvent;
  poisonEvent?: (actorId: EntityId) => GameEvent;
}

/** 共用原单枪消费；实际目标死亡和最终判胜仍归中央结算。 */
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
    const role = world.getComponent(actorId, COMPONENT.Role);
    const state = role ? rules.state(role) : undefined;
    if (
      !role ||
      role.role !== rules.role ||
      !state ||
      world.getComponent(actorId, COMPONENT.Alive)?.alive !== false
    )
      continue;
    const stock = rules.role === "hunter" ? openDemonHunterStockFrame(world, actorId, state) : null;
    const consume = () => {
      if (stock) stock.consume();
      else (state as { canShoot: boolean }).canShoot = false;
    };
    const sources = deathSources[actorId] ?? [];
    if (sources.includes(DeathCause.Poison)) {
      consume();
      if (rules.poisonEvent) events.push(rules.poisonEvent(actorId));
      continue;
    }
    const policy = rules.policy?.(state);
    const deathPhase = context?.deathOriginPhase;
    const nightEffect = context?.nightEffect;
    const causeIdentity = JSON.stringify(sources);
    if (
      !state.canShoot ||
      !rules.permits(sources) ||
      (policy !== undefined && !permitsDeathShot(sources, policy, deathPhase))
    ) {
      consume();
      continue;
    }
    const actorLife = world.getComponent(actorId, COMPONENT.Alive)!;
    const actorVersion = aliveLifeVersion(actorLife);
    const camp = role.camp,
      privateState = role.privateState;
    const targets = new Map(
      world.getAliveEntityIds().map((id) => [id, captureNightLife(world, id)]),
    );
    const selected = await choose(actorId);
    if (context?.isCurrent && !context.isCurrent()) break;
    if (stock && !stock.isCurrent()) throw new Error("demon_hunter_native_hunter_stock_revoked");
    const currentRole = world.getComponent(actorId, COMPONENT.Role);
    if (
      currentRole !== role ||
      currentRole.role !== rules.role ||
      currentRole.camp !== camp ||
      currentRole.privateState !== privateState ||
      rules.state(currentRole) !== state ||
      rules.policy?.(state) !== policy ||
      context?.deathOriginPhase !== deathPhase ||
      context?.nightEffect !== nightEffect ||
      JSON.stringify(deathSources[actorId] ?? []) !== causeIdentity ||
      !rules.permits(deathSources[actorId] ?? []) ||
      (policy !== undefined &&
        !permitsDeathShot(deathSources[actorId] ?? [], policy, deathPhase)) ||
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
      consume();
      continue;
    }
    if (selected.mappingCurrent && !selected.mappingCurrent()) continue;
    const targetScope = selected.targetScope ?? targets.get(selected.targetId);
    if (selected.mappedMiss) {
      if (
        !selected.mappingCurrent ||
        !targetScope ||
        targetScope.id !== selected.targetId ||
        world.getComponent(targetScope.id, COMPONENT.Alive) !== targetScope.life ||
        targetScope.life.alive ||
        aliveLifeVersion(targetScope.life) !== targetScope.version
      )
        continue;
      consume();
      events.push({
        timestamp: Date.now(),
        type: "death_shot_missed",
        payload: { actorId, reason: "no_effect" },
      });
      continue;
    }
    if (
      !targetScope ||
      targetScope.id !== selected.targetId ||
      !livingNightLife(world, targetScope)
    )
      continue;
    consume();
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
          context?.deathOriginPhase === deathPhase &&
          context?.nightEffect === nightEffect &&
          (policy === undefined ||
            permitsDeathShot(deathSources[actorId] ?? [], policy, deathPhase)) &&
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
