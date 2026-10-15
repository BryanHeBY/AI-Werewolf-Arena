/**
 * 负责纯白之女与狼巫各自原生角色查验政策。
 * 输入为共享只读查询后的当前 actor、合法目标和验证行动；输出保留历史及既定攻击效果。
 * 三个状态读取与历史追加委托 RoleInspection 具体 writer，use 委托实例 owner，仍在原位置。
 * 目标阵营只晚查真实值；已付攻击保原 owner／target谓词，不添加动作墓碑或组件引用撤权。
 * 不合并阵营／角色查验、失败语义或阶段顺序，不引入最终目标复检。
 */
import { roleInspectionPolicy } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { Camp, Phase, Role } from "../../domain/model";
import { DeathCause } from "../../domain/deaths";
import { captureNightLife, livingNightLife } from "../../domain/night-effects";
import type {
  TrustedNightStageRuntime as NightStageContext,
  TrustedNightStageHandler as NightStageHandler,
} from "../../engine/night/trusted-runtime";

import { recordNightAbilityUse } from "../night-abilities/inventory-ports";
import { captureNightAbilityScope } from "../night-abilities/scope-ports";
import { resolveInspection } from "../../engine/inspection";
import { ROLE_INSPECTION_STATE_SLOT } from "../role-inspection/ports";
import { recordRoleInspectionNightCommit } from "../role-inspection/night-commit-ports";
import { pureWhiteInspectionTargets } from "./rules";

async function execute(ctx: NightStageContext, policy: "pure_white" | "wolf_witch"): Promise<void> {
  const day = ctx.currentDay();
  const expectedRole = policy === "pure_white" ? Role.PureWhiteGirl : Role.WolfWitch;
  for (const { actorId, ability } of ctx.nightActors.actors("role_check", day)) {
    if (!ctx.isCurrent()) return;
    if (roleInspectionPolicy(ability.state) !== policy) continue;
    if (ability.source.kind !== "native" || ability.source.role !== expectedRole) continue;
    const scope = captureNightAbilityScope(
      ctx.world,
      actorId,
      ability,
      day,
      () => ctx.isCurrent() && ctx.currentDay() === day,
    );
    if (!scope || scope.role.role !== expectedRole) continue;
    const current = () => scope.isEligible() && roleInspectionPolicy(ability.state) === policy;
    const close = (reason: "passed" | "no_targets") => {
      if (!current()) return;
      recordNightAbilityUse(ability, day, false);
      ctx.events.push({
        timestamp: Date.now(),
        type: "role_inspection_skipped",
        payload: { actorId, day, reason },
      });
      // 跳过事实已按原点发表，随后才经轻端口登记本夜；发表失败不补登记或撤销先写的 use。
      recordRoleInspectionNightCommit(ctx.world, day, ctx.isCurrent);
    };
    const targets = new Map(
      pureWhiteInspectionTargets(ctx.world, actorId, policy).map((id) => {
        const life = captureNightLife(ctx.world, id);
        const role = ctx.world.getComponent(id, COMPONENT.Role);
        return [
          id,
          {
            life,
            role,
            identity: role?.role,
            camp: role == null ? undefined : ctx.world.getComponent(id, COMPONENT.Camp)?.camp,
          },
        ] as const;
      }),
    );
    if (!current()) continue;
    if (!targets.size) {
      close("no_targets");
      continue;
    }
    const request = ctx.makeRequest(actorId, ["inspect_night_identity"], {
      stage: policy === "pure_white" ? "pure_white_girl" : "wolf_witch",
      requiresAction: true,
      ability_id: ability.id,
      action_failure_policy: "error",
      allow_fallback: false,
    });
    const action = await ctx.actionProvider.getAction(request);
    if (!current()) continue;
    if (action?.name !== "inspect_night_identity")
      throw new Error("pure_white_inspection_action_missing");
    const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
      abilityId: ability.id,
    });
    if (!current()) continue;
    if (!validated.ok || validated.sanitizedCall?.name !== "inspect_night_identity")
      throw new Error("pure_white_inspection_action_invalid");
    const args = validated.sanitizedCall.args;
    if (args.abstain && args.target_id === null) {
      close("passed");
      continue;
    }
    const targetId = args.target_id;
    if (targetId === null) throw new Error("pure_white_inspection_target_invalid");
    const target = targets.get(targetId);
    const targetCurrent = () =>
      !!target?.life &&
      !!target.role &&
      livingNightLife(ctx.world, target.life) &&
      ctx.world.getComponent(targetId, COMPONENT.Role) === target.role &&
      target.role.role === target.identity &&
      ctx.world.getComponent(targetId, COMPONENT.Camp)?.camp === target.camp &&
      pureWhiteInspectionTargets(ctx.world, actorId, policy).includes(targetId);
    if (!targetCurrent()) throw new Error("pure_white_inspection_target_stale");
    const result = resolveInspection(ctx.world, targetId, "role", ctx.roleCatalog);
    if (!current()) continue;
    if (!result || !targetCurrent()) throw new Error("pure_white_inspection_target_stale");
    ROLE_INSPECTION_STATE_SLOT.allowedWrites.appendAbility(ability, targetId, day, result);
    recordNightAbilityUse(ability, day, true);
    ctx.events.push({
      timestamp: Date.now(),
      type: "role_inspected",
      payload: { actorId, targetId, day, result: { ...result } },
    });
    recordRoleInspectionNightCommit(ctx.world, day, ctx.isCurrent);
    if (
      day >= 2 &&
      (policy === "pure_white"
        ? target!.camp === Camp.Wolf
        : target!.identity === Role.PureWhiteGirl)
    ) {
      (ctx.state.inspectionAttacks ??= []).push({
        actorId,
        target: target!.life!,
        cause:
          policy === "pure_white" ? DeathCause.PureWhiteInspection : DeathCause.WolfWitchInspection,
        isCurrent: () =>
          scope.isOwnerCurrent() &&
          !ability.disabled &&
          !ability.deathExpired &&
          targetCurrent() &&
          roleInspectionPolicy(ability.state) === policy,
      });
    }
  }
}
export const PURE_WHITE_INSPECTION_STAGE: NightStageHandler = {
  id: "pure_white_inspection",
  priority: 610,
  execute: (ctx) => execute(ctx, "pure_white"),
};
export const WOLF_WITCH_INSPECTION_STAGE: NightStageHandler = {
  id: "wolf_witch_inspection",
  priority: 620,
  execute: (ctx) => execute(ctx, "wolf_witch"),
};

/** 模块定义完成时固定完整原程序引用；后来替换 execute 不能借原 handler 对象取得私有输入。这里不持有运行 World。 */
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze(
  [PURE_WHITE_INSPECTION_STAGE, WOLF_WITCH_INSPECTION_STAGE].map((handler) =>
    Object.freeze([handler, handler.execute] as const),
  ),
);
