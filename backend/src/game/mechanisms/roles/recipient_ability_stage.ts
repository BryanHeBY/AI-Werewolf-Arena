import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import { Camp, Phase, PotionType, StatusMark, type ToolName } from "../../../core/domain/model";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import type { World } from "../../../core/domain/world";
import type { NightStageHandler } from "../stages/night/contracts";
import { allNightAbilities, abilityStatus, recordNightAbilityUse, type NightAbility } from "./abilities";
import { captureNightAbilityScope } from "./ability_scope";
import { luckyTargetAllowed, recordOwnNightAction } from "./night_action_history";
import { resolveInspection } from "./inspection";

type RecipientPolicy = "lucky" | "black_market";
const committed = new WeakMap<World, Map<RecipientPolicy, Set<number>>>();
export function hasRecipientNightCommit(world: World, day: number, policy: RecipientPolicy): boolean { return committed.get(world)?.get(policy)?.has(day) ?? false; }
export function recordRecipientNightCommit(world: World, day: number, policy: RecipientPolicy): void { const policies = committed.get(world) ?? new Map<RecipientPolicy, Set<number>>(), days = policies.get(policy) ?? new Set<number>(); days.add(day); policies.set(policy, days); committed.set(world, policies); }

type LuckyAbility = NightAbility<"seer_check" | "potion" | "guard">;
function isRecipient(ability: NightAbility, policy: RecipientPolicy): ability is LuckyAbility {
  return ability.activation === policy && (policy === "black_market" ? ["seer_check", "potion"] : ["seer_check", "potion", "guard"]).includes(ability.kind);
}

export function recipientAbilityStage(policy: RecipientPolicy, priority: number): NightStageHandler { return {
  id: policy === "lucky" ? "lucky_ability" : "black_market_recipient", priority,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const actorId of ctx.world.getAliveEntityIds()) {
      const role = ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
      for (const ability of allNightAbilities(role).filter(ability => isRecipient(ability, policy))) {
        if (abilityStatus(ability, day) !== "active") continue;
        const scope = captureNightAbilityScope(ctx.world, actorId, ability, day, ctx.isCurrent);
        if (!scope) continue;
        const current = () => scope.isEligible() && ability.activation === policy && (ability.kind !== "potion" || ability.state.poison > 0);
        if (!current()) continue;
        const tool: ToolName = ability.kind === "seer_check" ? "check_identity" : ability.kind === "guard" ? "guard" : "use_potion";
        const kind = ability.kind === "seer_check" ? "check" : ability.kind === "guard" ? "guard" : "poison";
        const skip = () => {
          recordNightAbilityUse(ability, day, false); recordRecipientNightCommit(ctx.world, day, policy);
          ctx.events.push({ timestamp: Date.now(), type: "lucky_ability_skipped", payload: { actorId, abilityId: ability.id, day, kind: ability.kind } });
        };
        let completed = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!current()) break;
          const targets = new Map(ctx.world.getAliveEntityIds().filter(id => luckyTargetAllowed(ctx.world, actorId, ability, day, kind, id)).map(id => [id, captureNightLife(ctx.world, id)!] as const));
          if (ability.kind === "seer_check" && !targets.size) { skip(); completed = true; break; }
          const action = await ctx.actionProvider.getAction(ctx.makeRequest(actorId, [tool], { stage: policy === "lucky" ? "lucky" : "black_market_recipient", requiresAction: false, ...(policy === "black_market" ? { action_failure_policy: "error" as const, allow_fallback: false } : {}), ability_id: ability.id, ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}) }));
          if (!current()) break;
          if (action === null) { skip(); completed = true; break; }
          if (action.name !== tool) continue;
          const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, { phase: Phase.Night, day, abilityId: ability.id });
          if (!current() || !result.ok || !result.sanitizedCall) continue;
          const call = result.sanitizedCall;
          if (call.name === "guard" && call.args.abstain || call.name === "use_potion" && call.args.potion_type === PotionType.None) { skip(); completed = true; break; }
          if (!["guard", "use_potion", "check_identity"].includes(call.name) || !("target_id" in call.args)) continue;
          const target = call.args.target_id === null ? undefined : targets.get(call.args.target_id);
          if (!target || !livingNightLife(ctx.world, target)) continue;
          if (!luckyTargetAllowed(ctx.world, actorId, ability, day, kind, target.id)) continue;
          if (call.name === "check_identity" && ability.kind === "seer_check") {
            const result = resolveInspection(ctx.world, target.id, "camp", ctx.roleCatalog);
            if (!result || !current() || !livingNightLife(ctx.world, target) || !luckyTargetAllowed(ctx.world, actorId, ability, day, kind, target.id)) continue;
            const isWerewolf = result.camp === Camp.Wolf;
            ability.state.lastTarget = target.id; ability.state.lastIsWerewolf = isWerewolf; ability.state.lastResult = { ...result };
            ability.state.history.push({ targetId: target.id, isWerewolf, result: { ...result } });
            ctx.state.seerChecks.push({ seerId: actorId, targetId: target.id, isWerewolf, result: { ...result } });
            ctx.events.push({ timestamp: Date.now(), type: "seer_checked", payload: { actorId, abilityId: ability.id, targetId: target.id, isWerewolf, result: { ...result } } });
          } else if (call.name === "guard" && ability.kind === "guard") {
            const marks = ctx.ensureMarks(target.id); marks.add(StatusMark.GuardMark);
            (ctx.state.guardClaims ??= []).push({ target, marks }); ability.state.lastTarget = target.id;
            ctx.events.push({ timestamp: Date.now(), type: "guard_applied", payload: { actorId, abilityId: ability.id, abstain: false, targetId: target.id } });
          } else if (call.name === "use_potion" && call.args.potion_type === PotionType.Poison && ability.kind === "potion" && ability.state.poison > 0) {
            (ctx.state.poisonClaims ??= []).push({ source: scope.life, target, ...(policy === "black_market" ? { isCurrent: () => ctx.isCurrent() && ctx.currentDay() === day && scope.isOwnerCurrent(true) } : {}) }); ctx.ensureMarks(target.id).add(StatusMark.PoisonMark);
            ability.state.poison--; ability.state.poisonUsedThisNight = true;
            ctx.events.push({ timestamp: Date.now(), type: "witch_potion_used", payload: { actorId, abilityId: ability.id, targetId: target.id, potionType: PotionType.Poison } });
          } else continue;
          recordNightAbilityUse(ability, day, true); recordOwnNightAction(ctx.world, actorId, day, kind, target.id, true, policy); recordRecipientNightCommit(ctx.world, day, policy);
          completed = true; break;
        }
        if (!completed && current()) {
          if (ability.kind === "seer_check" && !ctx.world.getAliveEntityIds().some(id => luckyTargetAllowed(ctx.world, actorId, ability, day, "check", id))) skip();
          else throw new Error(policy === "black_market" ? "black_market_recipient_valid_action_missing" : "lucky_valid_action_missing");
        }
      }
    }
  },
}; }
