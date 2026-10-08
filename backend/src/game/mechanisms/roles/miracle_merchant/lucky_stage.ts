import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Phase, PotionType, StatusMark, type ToolName } from "../../../../core/domain/model";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import type { NightStageHandler } from "../../stages/night/contracts";
import { allNightAbilities, abilityStatus, recordNightAbilityUse, type NightAbility } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { luckyTargetAllowed, recordOwnNightAction } from "../night_action_history";
import { resolveInspection } from "../inspection";

const committed = new WeakMap<World, Set<number>>();
export function hasLuckyNightCommit(world: World, day: number): boolean { return committed.get(world)?.has(day) ?? false; }
export function recordLuckyNightCommit(world: World, day: number): void {
  const days = committed.get(world) ?? new Set<number>(); days.add(day); committed.set(world, days);
}

type LuckyAbility = NightAbility<"seer_check" | "potion" | "guard">;
function isLucky(ability: NightAbility): ability is LuckyAbility {
  return ability.activation === "lucky" && ["seer_check", "potion", "guard"].includes(ability.kind);
}

export const LUCKY_ABILITY_STAGE: NightStageHandler = {
  id: "lucky_ability", priority: 700,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const actorId of ctx.world.getAliveEntityIds()) {
      const role = ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
      for (const ability of allNightAbilities(role).filter(isLucky)) {
        if (abilityStatus(ability, day) !== "active") continue;
        const scope = captureNightAbilityScope(ctx.world, actorId, ability, day, ctx.isCurrent);
        if (!scope) continue;
        const current = () => scope.isEligible() && ability.activation === "lucky" && (ability.kind !== "potion" || ability.state.poison > 0);
        if (!current()) continue;
        const tool: ToolName = ability.kind === "seer_check" ? "check_identity" : ability.kind === "guard" ? "guard" : "use_potion";
        const kind = ability.kind === "seer_check" ? "check" : ability.kind === "guard" ? "guard" : "poison";
        const skip = () => {
          recordNightAbilityUse(ability, day, false); recordLuckyNightCommit(ctx.world, day);
          ctx.events.push({ timestamp: Date.now(), type: "lucky_ability_skipped", payload: { actorId, abilityId: ability.id, day, kind: ability.kind } });
        };
        let completed = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!current()) break;
          const targets = new Map(ctx.world.getAliveEntityIds().filter(id => luckyTargetAllowed(ctx.world, actorId, ability, day, kind, id)).map(id => [id, captureNightLife(ctx.world, id)!] as const));
          if (ability.kind === "seer_check" && !targets.size) { skip(); completed = true; break; }
          const action = await ctx.actionProvider.getAction(ctx.makeRequest(actorId, [tool], { stage: "lucky", requiresAction: false, ability_id: ability.id, ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}) }));
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
            (ctx.state.poisonClaims ??= []).push({ source: scope.life, target }); ctx.ensureMarks(target.id).add(StatusMark.PoisonMark);
            ability.state.poison--; ability.state.poisonUsedThisNight = true;
            ctx.events.push({ timestamp: Date.now(), type: "witch_potion_used", payload: { actorId, abilityId: ability.id, targetId: target.id, potionType: PotionType.Poison } });
          } else continue;
          recordNightAbilityUse(ability, day, true); recordOwnNightAction(ctx.world, actorId, day, kind, target.id, true); recordLuckyNightCommit(ctx.world, day);
          completed = true; break;
        }
        if (!completed && current()) throw new Error("lucky_valid_action_missing");
      }
    }
  },
};
