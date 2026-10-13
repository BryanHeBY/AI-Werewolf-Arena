/**
 * 负责学者／导师本夜选择及独立加成阶段。
 * 输入为有资格的加成行动者、原目标 receipt 和已校验行动；输出保留已付效果及本职历史。
 * 加成毒在原 receipt.commit 与印记付款之后附带来源，独立于女巫或受赠瓶数。
 * 本模块不重新计算别族的已付目标，也不将原体句柄或因果 Symbol 写入事件。
 */
import { COMPONENT, Camp, Phase, StatusMark, type RoleComponent } from "../../../../core";
import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import { originalPoisonIntent, type NightLifeScope } from "../../../../core/domain/night_effects";
import type { NightStageContext, NightStageHandler } from "../../stages/night/contracts";
import { resolveInspection } from "../inspection";
import {
  beginScholarMentorNight,
  commitScholarMentorChoice,
  settleScholarMentorChoices,
  scholarMentorStateForRole,
  scholarMentorChoiceTargets,
  assertScholarMentorRosterCurrent,
  scholarMentorBonusActors,
  scholarMentorBonusTargets,
  captureScholarMentorBonus,
  scholarMentorConflictDeaths,
  type ModifierBonusKind,
} from "./night_frame";
const choose: NightStageHandler = {
  id: "scholar_mentor_choice",
  priority: 50,
  async execute(ctx) {
    const day = ctx.currentDay(),
      pending = beginScholarMentorNight(ctx.world, day);
    for (const actorId of ctx.world.entityIds()) {
      const role = ctx.world.getComponent(actorId, COMPONENT.Role),
        state = scholarMentorStateForRole(role);
      if (!state) continue;
      if (!pending.includes(actorId)) {
        const reason =
          day === 1
            ? "first_night"
            : ctx.world.getAliveEntityIds().includes(actorId)
              ? "exhausted"
              : "dead";
        ctx.events.push({
          timestamp: Date.now(),
          type: "modifier_choice_skipped",
          payload: { actorId, day, reason },
          audience: Object.freeze([actorId]),
        });
        continue;
      }
      const modes = (["enhance", "weaken"] as const).filter((mode) => state.remaining[mode] === 1);
      const request = ctx.makeRequest(actorId, ["modify_skill"], {
        stage: "scholar_mentor_choice",
        requiresAction: true,
        action_failure_policy: "error",
        allow_fallback: false,
        modifier_modes: modes,
        modifier_candidates: scholarMentorChoiceTargets(ctx.world, day, actorId),
      });
      assertScholarMentorRosterCurrent(ctx.world);
      const action = await ctx.actionProvider.getAction(request);
      assertScholarMentorRosterCurrent(ctx.world);
      if (!ctx.isCurrent() || ctx.currentDay() !== day)
        throw new Error("scholar_mentor_choice_stale");
      if (action?.name !== "modify_skill") throw new Error("scholar_mentor_choice_missing");
      const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
        phase: Phase.Night,
        day,
      });
      assertScholarMentorRosterCurrent(ctx.world);
      if (!ctx.isCurrent() || !result.ok || result.sanitizedCall?.name !== "modify_skill")
        throw new Error("scholar_mentor_choice_invalid");
      const { mode, target_id } = result.sanitizedCall.args;
      commitScholarMentorChoice(ctx.world, day, actorId, mode, target_id);
      ctx.events.push({
        timestamp: Date.now(),
        type: "modifier_choice_committed",
        payload: { actorId, day, mode, targetId: target_id },
        audience: Object.freeze([actorId]),
      });
    }
    const result = settleScholarMentorChoices(ctx.world, day);
    ctx.state.modifierDeaths = scholarMentorConflictDeaths(ctx.world, day);
    if (result.conflict !== null)
      ctx.events.push({
        timestamp: Date.now(),
        type: "modifier_conflict_resolved",
        payload: { day, kind: result.conflict, targetId: result.pendingDeaths[0]! },
        audience: Object.freeze([]),
      });
  },
};
export function assertScholarMentorBonusEffects(ctx: NightStageContext): void {
  assertScholarMentorRosterCurrent(ctx.world);
  for (const effect of ctx.state.modifierBonusEffects ?? []) {
    const target = effect.receipt.target;
    if (
      !effect.receipt.effectCurrent() ||
      (target &&
        (ctx.world.getComponent(target.id, COMPONENT.Alive) !== target.life ||
          aliveLifeVersion(target.life) !== target.version)) ||
      (effect.marks &&
        target &&
        ctx.world.getComponent(target.id, COMPONENT.StatusMarks) !== effect.marks)
    )
      throw new Error("scholar_mentor_bonus_effect_stale");
  }
}
function bonus(kind: ModifierBonusKind, priority: number): NightStageHandler {
  return {
    id: "scholar_mentor_bonus_" + kind,
    priority,
    async execute(ctx) {
      const day = ctx.currentDay();
      for (const actorId of scholarMentorBonusActors(ctx.world, day, kind)) {
        const request = ctx.makeRequest(actorId, ["bonus_action"], {
          stage: "scholar_mentor_bonus",
          requiresAction: true,
          action_failure_policy: "error",
          allow_fallback: false,
          modifier_bonus_kind: kind,
          modifier_bonus_candidates: scholarMentorBonusTargets(ctx.world, day, actorId, kind),
        });
        assertScholarMentorRosterCurrent(ctx.world);
        const action = await ctx.actionProvider.getAction(request);
        assertScholarMentorRosterCurrent(ctx.world);
        if (!ctx.isCurrent() || ctx.currentDay() !== day)
          throw new Error("scholar_mentor_bonus_stale");
        if (action?.name !== "bonus_action" || action.args.kind !== kind)
          throw new Error("scholar_mentor_bonus_missing");
        const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
          phase: Phase.Night,
          day,
        });
        assertScholarMentorRosterCurrent(ctx.world);
        if (
          !ctx.isCurrent() ||
          !result.ok ||
          result.sanitizedCall?.name !== "bonus_action" ||
          result.sanitizedCall.args.kind !== kind
        )
          throw new Error("scholar_mentor_bonus_invalid");
        const { target_id: targetId, abstain } = result.sanitizedCall.args;
        const receipt = captureScholarMentorBonus(ctx.world, day, actorId, kind, targetId);
        const inspection =
          kind === "check" && targetId !== null
            ? resolveInspection(ctx.world, targetId, "camp", ctx.roleCatalog)
            : null;
        if (kind === "check" && targetId !== null && !inspection)
          throw new Error("scholar_mentor_inspection_invalid");
        if (!receipt.isCurrent() || !ctx.isCurrent()) throw new Error("scholar_mentor_bonus_stale");
        receipt.commit();
        if (targetId !== null && receipt.target) {
          if (kind === "check") {
            ctx.state.seerChecks.push({
              seerId: actorId,
              targetId,
              isWerewolf: inspection!.camp === Camp.Wolf,
              result: { ...inspection! },
            });
            (ctx.state.modifierBonusEffects ??= []).push({ kind, receipt });
          } else {
            const marks = ctx.ensureMarks(targetId);
            if (kind === "guard") {
              marks.add(StatusMark.GuardMark);
              (ctx.state.guardClaims ??= []).push({
                target: receipt.target,
                marks,
                isCurrent: receipt.effectCurrent,
              });
            } else if (kind === "poison") {
              marks.add(StatusMark.PoisonMark);
              // source 在原对象字段求值位置读取一次；receipt 的付款和当前性仍归 frame。
              let effectSource: NightLifeScope;
              (ctx.state.poisonClaims ??= []).push(originalPoisonIntent({
                source: (effectSource = receipt.source),
                target: receipt.target,
                isCurrent: receipt.effectCurrent,
              }, {
                family: "scholar-mentor",
                day,
                stage: "scholar_mentor_bonus",
                actorLife: effectSource,
                requestedTargetId: targetId,
                abilityId: "bonus:poison",
              }));
            } else {
              marks.add(StatusMark.WolfKillMark);
              (ctx.state.modifierKnifeTargets ??= []).push(targetId);
            }
            (ctx.state.modifierBonusEffects ??= []).push({ kind, receipt, marks });
          }
        }
        ctx.events.push({
          timestamp: Date.now(),
          type: "modifier_bonus_resolved",
          payload: {
            actorId,
            day,
            kind,
            targetId,
            abstain,
            ...(inspection ? { isWerewolf: inspection.camp === Camp.Wolf } : {}),
          },
          audience: Object.freeze([actorId]),
        });
      }
      assertScholarMentorBonusEffects(ctx);
    },
  };
}
export const SCHOLAR_MENTOR_NIGHT_STAGES: NightStageHandler[] = [
  choose,
  bonus("guard", 350),
  bonus("kill", 450),
  bonus("poison", 550),
  bonus("check", 650),
];
