/**
 * 负责机械狼模式、学习、复制技能和额外刀阶段。
 * 输入为原 owner/mode/技能 scope 与已验证工具；输出为原已付事实及有来源的盾、刀、失败、原毒 intent。
 * intent 只复用原捕获 life/day/目标，不增加 World、时钟或 RNG 读取；原付款和记录次序保持。
 * 有效性仍由原 callback 决定，不合并不同技能资源或失败规则；运行时来源不写入归档。
 */
import {
  recordMechanicalInspection,
  consumeMechanicalPoison,
  closeMechanicalExtraKnife,
} from "./state";

import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { Phase, StatusMark, type EntityId, type ToolName } from "../../domain/model";
import {
  captureNightLife,
  livingNightLife,
  mechanicalNightIntent,
  originalPoisonIntent,
} from "../../domain/night-effects";
import type {
  TrustedNightStageRuntime as NightStageContext,
  TrustedNightStageHandler as NightStageHandler,
} from "../../engine/night/trusted-runtime";
import { resolveInspection } from "../../engine/inspection";
import { canMechanicalKnife } from "./inheritance";
import {
  bindMechanicalSkill,
  captureMechanicalOwner,
  recordMechanicalModeScope,
  recordMechanicalNightCommit,
} from "./night-scope";
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
      // 原已学习枪的武装／首刀到期是生命周期；退休只阻止后面的新模式，不跳过此前缀。
      advanceMechanicalNight(owner.state, day);
      if (!canSelectMechanicalMode(owner.state, day) || !owner.canAct()) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!owner.isCurrent() || !canSelectMechanicalMode(owner.state, day) || !owner.canAct())
          break;
        const action = await ctx.actionProvider.getAction(
          ctx.makeRequest(owner.actorId, ["mechanical_mode"], {
            stage: "mechanical_mode",
            requiresAction: false,
            ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
          }),
        );
        if (!owner.isCurrent() || !canSelectMechanicalMode(owner.state, day) || !owner.canAct())
          break;
        let chosenMode: "skill" | "kill" = "skill";
        if (action !== null) {
          if (action.name !== "mechanical_mode") continue;
          const valid = ctx.toolGateway.validateAndSanitize(ctx.world, owner.actorId, action, {
            phase: Phase.Night,
            day,
          });
          if (
            !owner.isCurrent() ||
            !valid.ok ||
            valid.sanitizedCall?.name !== "mechanical_mode" ||
            !owner.canAct()
          )
            continue;
          chosenMode = valid.sanitizedCall.args.mode;
        }
        // args.mode 等晚 getter 已读完；首个模式写入前只复验退休标记。
        if (!owner.canAct()) break;
        if (!selectMechanicalMode(owner.state, day, chosenMode, owner.canAct)) break;
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
      if (
        !completed &&
        owner.isCurrent() &&
        canSelectMechanicalMode(owner.state, day) &&
        owner.canAct()
      )
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
        if (!owner.isCurrent() || !canMechanicalMimic(owner.state, day) || !owner.canAct()) break;
        const candidates = targets(ctx, owner.actorId, true);
        const targetRoles = new Map(
          [...candidates.keys()].map((id) => {
            const role = ctx.world.getComponent(id, COMPONENT.Role)!;
            return [id, { component: role, role: role.role }] as const;
          }),
        );
        if (!owner.canAct()) break;
        const action = candidates.size
          ? await ctx.actionProvider.getAction(
              ctx.makeRequest(owner.actorId, ["mimic_role"], {
                stage: "mechanical_mimic",
                requiresAction: false,
                ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
              }),
            )
          : null;
        if (!owner.isCurrent() || !canMechanicalMimic(owner.state, day) || !owner.canAct()) break;
        if (action === null) {
          if (!closeMechanicalMimic(owner.state, day, owner.canAct)) break;
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
          !canMechanicalMimic(owner.state, day) ||
          !owner.canAct()
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
        // 候选原体／生命 getter 仍先按原序执行，退休后不写入新的学习数据。
        if (!owner.canAct()) break;
        if (!learnMechanicalRole(owner.state, targetId, targetRole.role, day, owner.canAct))
          continue;
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
      if (!completed && owner.isCurrent() && canMechanicalMimic(owner.state, day) && owner.canAct())
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
        (skill.kind !== "poison" || skill.remaining > 0) &&
        owner.canAct();
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
        const candidates = targets(ctx, owner.actorId, skill.kind === "inspection");
        if (!owner.canAct()) break;
        const action = await ctx.actionProvider.getAction(
          ctx.makeRequest(owner.actorId, [tool], {
            stage: "mechanical_skill",
            requiresAction: false,
            ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
          }),
        );
        if (!current()) break;
        if (action === null) {
          if (!closeMechanicalSkill(owner.state, day, owner.canAct)) break;
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
          if (!result || !current() || !livingNightLife(ctx.world, target) || !owner.canAct())
            continue;
          if (!recordMechanicalInspection(skill, day, target, result, owner.canAct)) break;
          ctx.events.push({
            timestamp: Date.now(),
            type: "role_inspected",
            payload: { actorId: owner.actorId, day, targetId: target.id, result: { ...result } },
          });
        } else if (call.name === "mechanical_poison" && skill.kind === "poison" && target) {
          // 首个 claim 写入之前拒绝晚退休；一旦开始原提交序列，不借墓碑撤销已写前缀。
          if (!owner.canAct()) break;
          (ctx.state.poisonClaims ??= []).push(
            originalPoisonIntent(
              { source: owner.life, target },
              {
                family: "mechanical",
                day,
                stage: "mechanical_skill",
                actorLife: owner.life,
                requestedTargetId: targetId,
                abilityId: "learned:mechanical",
              },
            ),
          );
          ctx.ensureMarks(target.id).add(StatusMark.PoisonMark);
          consumeMechanicalPoison(skill);
          ctx.events.push({
            timestamp: Date.now(),
            type: "mechanical_poison_used",
            payload: { actorId: owner.actorId, day, targetId: target.id },
          });
        } else if (call.name === "mechanical_guard" && skill.kind === "guard") {
          if (!owner.canAct()) break;
          const chosen = chooseMechanicalGuard(skill, targetId, day, owner.canAct);
          if (!chosen) break;
          const { failed } = chosen;
          if (failed)
            effects(ctx).failures.push(
              mechanicalNightIntent(
                "mechanical-failure",
                {
                  actorId: owner.actorId,
                  target: owner.life,
                  isCurrent: bound.isCurrent,
                },
                {
                  family: "mechanical",
                  day,
                  stage: "mechanical_skill",
                  actorLife: owner.life,
                  requestedTargetId: targetId,
                  abilityId: "learned:mechanical",
                },
              ),
            );
          else if (target)
            effects(ctx).shields.push(
              mechanicalNightIntent(
                "mechanical-shield",
                {
                  actorId: owner.actorId,
                  target,
                  isCurrent: bound.isCurrent,
                },
                {
                  family: "mechanical",
                  day,
                  stage: "mechanical_skill",
                  actorLife: owner.life,
                  requestedTargetId: targetId,
                  abilityId: "learned:mechanical",
                },
              ),
            );
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
        canMechanicalKnife(owner.role, ctx.world, () =>
          ctx.world.getComponent(owner.actorId, COMPONENT.Camp),
        );
      const current = () =>
        effectCurrent() && canMechanicalExtraKnife(owner.state, day) && owner.canAct();
      if (!current()) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
        const candidates = targets(ctx, owner.actorId, false);
        if (!owner.canAct()) break;
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
        // 额外刀的目标生命复验完成后才检查未付资格；effectCurrent 保持纯已付谓词。
        if (!owner.canAct()) break;
        if (target)
          effects(ctx).attacks.push(
            mechanicalNightIntent(
              "mechanical-attack",
              { actorId: owner.actorId, target, isCurrent: effectCurrent },
              {
                family: "mechanical",
                day,
                stage: "mechanical_attack",
                actorLife: owner.life,
                requestedTargetId: targetId,
                abilityId: "learned:mechanical",
              },
            ),
          );
        closeMechanicalExtraKnife(skill, target);
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

/** 模块定义完成时固定完整原程序引用；后来替换 execute 不能借原 handler 对象取得私有输入。这里不持有运行 World。 */
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze(
  [...MECHANICAL_NIGHT_STAGES].map((handler) => Object.freeze([handler, handler.execute] as const)),
);
