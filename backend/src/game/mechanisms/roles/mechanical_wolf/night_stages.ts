import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Phase, StatusMark, type EntityId, type ToolName } from "../../../../core/domain/model";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import type { NightStageContext, NightStageHandler } from "../../stages/night/contracts";
import { resolveInspection } from "../inspection";
import { canMechanicalKnife } from "./inheritance";
import {
  bindMechanicalSkill,
  captureMechanicalOwner,
  recordMechanicalModeScope,
  recordMechanicalNightCommit,
} from "./night_scope";
import {
  advanceMechanicalNight,
  canMechanicalMimic,
  canSelectMechanicalMode,
  chooseMechanicalGuard,
  closeMechanicalMimic,
  closeMechanicalSkill,
  learnMechanicalRole,
  mechanicalSkillForNight,
  selectMechanicalMode,
  canMechanicalExtraKnife,
} from "./state";

function owners(ctx: NightStageContext) {
  return ctx.world.getAliveEntityIds().flatMap((id) => {
    const owner = captureMechanicalOwner(ctx.world, id, ctx.isCurrent);
    return owner ? [owner] : [];
  });
}
function targets(ctx: NightStageContext, actorId: EntityId, excludeSelf: boolean) {
  return new Map(
    ctx.world
      .getAliveEntityIds()
      .filter((id) => !excludeSelf || id !== actorId)
      .map((id) => [id, captureNightLife(ctx.world, id)!] as const),
  );
}
function effects(ctx: NightStageContext) {
  return (ctx.state.mechanicalEffects ??= { shields: [], attacks: [], failures: [] });
}

const modeStage: NightStageHandler = {
  id: "mechanical_mode",
  priority: 250,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const owner of owners(ctx)) {
      if (!owner.isCurrent()) continue;
      advanceMechanicalNight(owner.state, day);
      if (!canSelectMechanicalMode(owner.state, day)) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!owner.isCurrent() || !canSelectMechanicalMode(owner.state, day)) break;
        const action = await ctx.actionProvider.getAction(
          ctx.makeRequest(owner.actorId, ["mechanical_mode"], {
            stage: "mechanical_mode",
            requiresAction: false,
            ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
          }),
        );
        if (!owner.isCurrent() || !canSelectMechanicalMode(owner.state, day)) break;
        let chosenMode: "skill" | "kill" = "skill";
        if (action !== null) {
          if (action.name !== "mechanical_mode") continue;
          const valid = ctx.toolGateway.validateAndSanitize(ctx.world, owner.actorId, action, {
            phase: Phase.Night,
            day,
          });
          if (!owner.isCurrent() || !valid.ok || valid.sanitizedCall?.name !== "mechanical_mode")
            continue;
          chosenMode = valid.sanitizedCall.args.mode;
        }
        if (!selectMechanicalMode(owner.state, day, chosenMode)) break;
        recordMechanicalModeScope(ctx.world, owner, day);
        recordMechanicalNightCommit(ctx.world, day);
        ctx.events.push({
          timestamp: Date.now(),
          type: "mechanical_mode_selected",
          payload: { actorId: owner.actorId, day, mode: owner.state.mode!.kind },
        });
        completed = true;
        break;
      }
      if (!completed && owner.isCurrent() && canSelectMechanicalMode(owner.state, day))
        throw new Error("mechanical_mode_valid_action_missing");
    }
  },
};

const mimicStage: NightStageHandler = {
  id: "mechanical_mimic",
  priority: 580,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const owner of owners(ctx)) {
      if (!canMechanicalMimic(owner.state, day)) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!owner.isCurrent() || !canMechanicalMimic(owner.state, day)) break;
        const candidates = targets(ctx, owner.actorId, true);
        const targetRoles = new Map(
          [...candidates.keys()].map((id) => {
            const role = ctx.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
            return [id, { component: role, role: role.role }] as const;
          }),
        );
        const action = candidates.size
          ? await ctx.actionProvider.getAction(
              ctx.makeRequest(owner.actorId, ["mimic_role"], {
                stage: "mechanical_mimic",
                requiresAction: false,
                ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
              }),
            )
          : null;
        if (!owner.isCurrent() || !canMechanicalMimic(owner.state, day)) break;
        if (action === null) {
          closeMechanicalMimic(owner.state, day);
          recordMechanicalNightCommit(ctx.world, day);
          ctx.events.push({
            timestamp: Date.now(),
            type: "mechanical_mimic_skipped",
            payload: { actorId: owner.actorId, day },
          });
          completed = true;
          break;
        }
        if (action.name !== "mimic_role") continue;
        const valid = ctx.toolGateway.validateAndSanitize(ctx.world, owner.actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (
          !owner.isCurrent() ||
          !valid.ok ||
          valid.sanitizedCall?.name !== "mimic_role" ||
          !canMechanicalMimic(owner.state, day)
        )
          continue;
        const targetId = valid.sanitizedCall.args.target_id,
          target = candidates.get(targetId),
          targetRole = targetRoles.get(targetId);
        if (
          !target ||
          !livingNightLife(ctx.world, target) ||
          !targetRole ||
          ctx.world.getComponent(targetId, COMPONENT.Role) !== targetRole.component ||
          targetRole.component.role !== targetRole.role
        )
          continue;
        if (!learnMechanicalRole(owner.state, targetId, targetRole.role, day)) continue;
        recordMechanicalNightCommit(ctx.world, day);
        ctx.events.push({
          timestamp: Date.now(),
          type: "mechanical_mimicked",
          payload: {
            actorId: owner.actorId,
            day,
            targetId,
            role: owner.state.learned!.role,
            readyOnNight: day + 1,
          },
        });
        completed = true;
        break;
      }
      if (!completed && owner.isCurrent() && canMechanicalMimic(owner.state, day))
        throw new Error("mechanical_mimic_valid_action_missing");
    }
  },
};

const skillStage: NightStageHandler = {
  id: "mechanical_skill",
  priority: 650,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const owner of owners(ctx)) {
      const skill = mechanicalSkillForNight(owner.state, day),
        bound = bindMechanicalSkill(owner, day);
      if (!skill || !bound || !["inspection", "poison", "guard"].includes(skill.kind)) continue;
      if (skill.kind === "poison" && skill.remaining === 0) continue;
      const tool: ToolName =
        skill.kind === "inspection"
          ? "mechanical_inspect"
          : skill.kind === "poison"
            ? "mechanical_poison"
            : "mechanical_guard";
      const current = () =>
        bound.isCurrent() &&
        mechanicalSkillForNight(owner.state, day) === skill &&
        (skill.kind !== "poison" || skill.remaining > 0);
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
        const candidates = targets(ctx, owner.actorId, skill.kind === "inspection");
        const action = await ctx.actionProvider.getAction(
          ctx.makeRequest(owner.actorId, [tool], {
            stage: "mechanical_skill",
            requiresAction: false,
            ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
          }),
        );
        if (!current()) break;
        if (action === null) {
          closeMechanicalSkill(owner.state, day);
          recordMechanicalNightCommit(ctx.world, day);
          ctx.events.push({
            timestamp: Date.now(),
            type: "mechanical_skill_skipped",
            payload: { actorId: owner.actorId, day },
          });
          completed = true;
          break;
        }
        if (action.name !== tool) continue;
        const valid = ctx.toolGateway.validateAndSanitize(ctx.world, owner.actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (!current() || !valid.ok || !valid.sanitizedCall) continue;
        const call = valid.sanitizedCall;
        if (
          !["mechanical_inspect", "mechanical_poison", "mechanical_guard"].includes(call.name) ||
          !("target_id" in call.args)
        )
          continue;
        const targetId = call.args.target_id,
          target = targetId === null ? null : candidates.get(targetId);
        if (targetId !== null && (!target || !livingNightLife(ctx.world, target))) continue;
        if (call.name === "mechanical_inspect" && skill.kind === "inspection" && target) {
          const result = resolveInspection(ctx.world, target.id, "role", ctx.roleCatalog);
          if (!result || !current() || !livingNightLife(ctx.world, target)) continue;
          skill.history.push({ day, targetId: target.id, result: { ...result } });
          ctx.events.push({
            timestamp: Date.now(),
            type: "role_inspected",
            payload: { actorId: owner.actorId, day, targetId: target.id, result: { ...result } },
          });
        } else if (call.name === "mechanical_poison" && skill.kind === "poison" && target) {
          (ctx.state.poisonClaims ??= []).push({ source: owner.life, target });
          ctx.ensureMarks(target.id).add(StatusMark.PoisonMark);
          skill.remaining = 0;
          ctx.events.push({
            timestamp: Date.now(),
            type: "mechanical_poison_used",
            payload: { actorId: owner.actorId, day, targetId: target.id },
          });
        } else if (call.name === "mechanical_guard" && skill.kind === "guard") {
          const { failed } = chooseMechanicalGuard(skill, targetId, day);
          if (failed)
            effects(ctx).failures.push({
              actorId: owner.actorId,
              target: owner.life,
              isCurrent: bound.isCurrent,
            });
          else if (target)
            effects(ctx).shields.push({
              actorId: owner.actorId,
              target,
              isCurrent: bound.isCurrent,
            });
          ctx.events.push({
            timestamp: Date.now(),
            type: "mechanical_guard_chosen",
            payload: { actorId: owner.actorId, day, targetId, failed },
          });
        } else continue;
        closeMechanicalSkill(owner.state, day);
        recordMechanicalNightCommit(ctx.world, day);
        completed = true;
        break;
      }
      if (!completed && current()) throw new Error("mechanical_skill_valid_action_missing");
    }
  },
};

const attackStage: NightStageHandler = {
  id: "mechanical_attack",
  priority: 660,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const owner of owners(ctx)) {
      const learned = owner.state.learned,
        mode = owner.state.mode;
      if (learned?.skill.kind !== "wolf" || !mode) continue;
      const skill = learned.skill;
      const effectCurrent = () =>
        owner.isCurrent() &&
        owner.state.learned === learned &&
        learned.skill === skill &&
        skill.kind === "wolf" &&
        owner.state.mode === mode &&
        mode.day === day &&
        mode.kind === "kill" &&
        canMechanicalKnife(owner.role, ctx.world);
      const current = () => effectCurrent() && canMechanicalExtraKnife(owner.state, day);
      if (!current()) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
        const candidates = targets(ctx, owner.actorId, false);
        const action = await ctx.actionProvider.getAction(
          ctx.makeRequest(owner.actorId, ["mechanical_attack"], {
            stage: "mechanical_attack",
            requiresAction: false,
            ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
          }),
        );
        if (!current()) break;
        let targetId: number | null = null;
        if (action !== null) {
          if (action.name !== "mechanical_attack") continue;
          const valid = ctx.toolGateway.validateAndSanitize(ctx.world, owner.actorId, action, {
            phase: Phase.Night,
            day,
          });
          if (!current() || !valid.ok || valid.sanitizedCall?.name !== "mechanical_attack")
            continue;
          targetId = valid.sanitizedCall.args.target_id;
        }
        const target = targetId === null ? null : candidates.get(targetId);
        if (targetId !== null && (!target || !livingNightLife(ctx.world, target))) continue;
        if (target)
          effects(ctx).attacks.push({ actorId: owner.actorId, target, isCurrent: effectCurrent });
        skill.extraKnife = target ? "spent" : "expired";
        recordMechanicalNightCommit(ctx.world, day);
        ctx.events.push({
          timestamp: Date.now(),
          type: "mechanical_attack_chosen",
          payload: { actorId: owner.actorId, day, targetId },
        });
        completed = true;
        break;
      }
      if (!completed && current()) throw new Error("mechanical_attack_valid_action_missing");
    }
  },
};

export const MECHANICAL_NIGHT_STAGES = [modeStage, mimicStage, skillStage, attackStage];
