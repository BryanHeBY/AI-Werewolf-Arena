import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Phase } from "../../../../core/domain/model";
import type { NightStageContext, NightStageHandler } from "../../stages/night/contracts";
import { activeNightAbility, nightAbilityActors, recordNightAbilityUse, roleInspectionPolicy, type RoleInspectionPolicy, type NightAbility } from "../abilities";
import { getGargoyleState } from "../private_state";
import { resolveInspection } from "../inspection";
import { beginRoleInspectionNight, recordRoleInspectionCompletion, recordRoleInspectionNightCommit } from "./night_scope";
import { roleInspectionTargets } from "./rules";

function finishPsychic(ctx: NightStageContext, actorId: number, ability: NightAbility<"role_check">, day: number, reason: "passed" | "no_targets"): void {
  recordNightAbilityUse(ability, day, false);
  ctx.events.push({ timestamp: Date.now(), type: "role_inspection_skipped", payload: { actorId, ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }), day, reason } });
  recordRoleInspectionNightCommit(ctx.world, day, ctx.isCurrent);
}
async function executeInspections(ctx: NightStageContext, policy: RoleInspectionPolicy): Promise<void> {
  const day = ctx.currentDay();
  if (policy === "gargoyle") beginRoleInspectionNight(ctx.world, day);
  for (const { actorId, ability } of nightAbilityActors(ctx.world, "role_check", day)) {
    if (!ctx.isCurrent()) return;
    if (roleInspectionPolicy(ability.state) !== policy) continue;
    const role = ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!;
    const kind = role.role, camp = role.camp, privateState = role.privateState, gargoyleState = getGargoyleState(role), state = ability.state;
    const life = ctx.world.getComponent<AliveComponent>(actorId, COMPONENT.Alive)!, version = aliveLifeVersion(life);
    const current = () => ctx.isCurrent() && ctx.world.getComponent(actorId, COMPONENT.Role) === role && role.role === kind && role.camp === camp && role.privateState === privateState && getGargoyleState(role) === gargoyleState && activeNightAbility(role, "role_check", day, ability.id) === ability && ability.state === state && roleInspectionPolicy(state) === policy && ctx.world.getComponent(actorId, COMPONENT.Alive) === life && life.alive && version !== undefined && aliveLifeVersion(life) === version;
    const exhausted = () => policy === "gargoyle" ? recordRoleInspectionCompletion(ctx.world, actorId, day, ability, ctx.isCurrent) : finishPsychic(ctx, actorId, ability, day, "no_targets");
    if (!current()) continue;
    if (!roleInspectionTargets(ctx.world, actorId, state).length) { exhausted(); continue; }
    let completed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!current()) break;
      const targets = new Map(roleInspectionTargets(ctx.world, actorId, state).map(id => {
        const target = ctx.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
        return [id, { target, version: aliveLifeVersion(target) }] as const;
      }));
      if (!targets.size) { exhausted(); completed = true; break; }
      const action = await ctx.actionProvider.getAction(ctx.makeRequest(actorId, ["inspect_role"], { stage: policy === "gargoyle" ? "role_inspection" : "psychic", requiresAction: policy === "gargoyle", ability_id: ability.id, ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}) }));
      if (!current()) break;
      if (action === null && policy === "psychic") { finishPsychic(ctx, actorId, ability, day, "passed"); completed = true; break; }
      if (action?.name !== "inspect_role") continue;
      const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, { phase: Phase.Night, day, abilityId: ability.id });
      if (!current() || !validated.ok || validated.sanitizedCall?.name !== "inspect_role") continue;
      const targetId = validated.sanitizedCall.args.target_id, target = targets.get(targetId);
      const targetCurrent = () => !!target && ctx.world.getComponent(targetId, COMPONENT.Alive) === target.target && target.target.alive && target.version !== undefined && aliveLifeVersion(target.target) === target.version;
      if (!targetCurrent()) continue;
      const result = resolveInspection(ctx.world, targetId, "role", ctx.roleCatalog);
      if (!current() || !targetCurrent() || !result) continue;
      state.lastTarget = targetId; state.lastDay = day; state.history.push({ day, targetId, result: { ...result } });
      recordNightAbilityUse(ability, day, true);
      ctx.events.push({ timestamp: Date.now(), type: "role_inspected", payload: { actorId, ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }), targetId, day, result: { ...result } } });
      if (policy === "gargoyle") recordRoleInspectionCompletion(ctx.world, actorId, day, ability, ctx.isCurrent);
      else recordRoleInspectionNightCommit(ctx.world, day, ctx.isCurrent);
      completed = true; break;
    }
    if (!completed && current()) {
      if (roleInspectionTargets(ctx.world, actorId, state).length) throw new Error(policy === "gargoyle" ? "role_inspection_required_action_missing" : "role_inspection_valid_action_missing");
      exhausted();
    }
  }
}
export const ROLE_INSPECTION_STAGE: NightStageHandler = { id: "role_inspection", priority: 180, execute: ctx => executeInspections(ctx, "gargoyle") };
export const PSYCHIC_INSPECTION_STAGE: NightStageHandler = { id: "psychic_inspection", priority: 600, execute: ctx => executeInspections(ctx, "psychic") };
