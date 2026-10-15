/**
 * 负责普通预言家对捕获能力及目标权威的查验请求。
 * 输入为原夜上下文和校验行动；输出保留查验结果、状态、use 和事件效果。
 * 资格枚举走只读查询，具体 Seer 状态与公共 use 命令在原 commit 位置执行；映射与咒狐顺序不变。
 * Demon 封存原生控制器保持独立，不额外验证租约、退款或将原体信息写入玩家知识。
 */
import { SEER_STATE_SLOT } from "./ports";
/** 文件说明：预言家夜间查验阶段处理。 */
import { seerTargetAllowed } from "./ports";
import { COMPONENT } from "../../../../domain/components/names";
import { RoleComponent } from "../../../../domain/components/role";
import { Camp, Phase, Role } from "../../../../domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getSeerState } from "./ports";
import { resolveInspection } from "../inspection";
import { activeNightAbility } from "../abilities";
import { recordNightAbilityUse } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { captureNightLife, livingNightLife } from "../../../../domain/night-effects";
import { recordOwnNightAction, luckyTargetAllowed } from "../night_action_history";

import { captureInspectionIdentity, commitFoxInspection } from "../cursed_fox/inspection-ports";

const seerCheckStage: NightStageHandler = {
  id: "seer_check",
  priority: 600,
  async execute(ctx): Promise<void> {
    if (ctx.nativeNightFailure.usesDemonController()) {
      const { executeDemonNativeNight } = await ctx.nativeNightEffects.loadSealedNightController();
      await executeDemonNativeNight(ctx, "seer_check");
      return;
    }
    for (const { actorId: seerId, ability } of ctx.nightActors.actors(
      "seer_check",
      ctx.currentDay(),
    )) {
      if (ability.activation === "lucky" || ability.activation === "black_market") continue;
      ctx.nativeNightFailure.assertSeerSource(ability);
      ctx.nativeNightFailure.assertNativeActor(seerId, Role.Seer);
      const day = ctx.currentDay(),
        scope = captureNightAbilityScope(
          ctx.world,
          seerId,
          ability,
          day,
          () => ctx.isCurrent() && ctx.currentDay() === day,
        );
      if (!scope?.isEligible()) continue;
      const targets = new Map(
        ctx.world.getAliveEntityIds().map((id) => [id, captureNightLife(ctx.world, id)]),
      );
      const identities = new Map(
        [...targets].flatMap(([id, life]) =>
          life ? [[id, captureInspectionIdentity(ctx.world, life)] as const] : [],
        ),
      );
      if (
        !ctx.world.getAliveEntityIds().includes(seerId) ||
        activeNightAbility(
          ctx.world.getComponent(seerId, COMPONENT.Role),
          "seer_check",
          ctx.currentDay(),
          ability.id,
        ) !== ability
      )
        continue;
      const legalTargets = ctx.world
        .getAliveEntityIds()
        .filter(
          (id) =>
            seerTargetAllowed(ability.state, seerId, id) &&
            luckyTargetAllowed(ctx.world, seerId, ability, day, "check", id),
        );
      if (!legalTargets.length) continue;
      const req = ctx.makeRequest(seerId, ["check_identity"], {
        stage: "seer",
        ability_id: ability.id,
        requiresAction: ability.state.actionPolicy !== "awa_optional_v1",
      });
      if (!scope.isEligible()) {
        ctx.nativeNightFailure.scopeStale("seer");
        continue;
      }
      const action = await ctx.actionProvider.getAction(req);
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        ctx.nativeNightFailure.scopeStale("seer");
        continue;
      }
      if (action?.name !== "check_identity") {
        ctx.nativeNightFailure.actionMissing("seer");
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, seerId, action, {
        phase: Phase.Night,
        day: ctx.currentDay(),
        abilityId: ability.id,
      });
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        ctx.nativeNightFailure.scopeStale("seer");
        continue;
      }
      if (!result.ok || !result.sanitizedCall) {
        ctx.nativeNightFailure.actionInvalid("seer");
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      const target = targets.get(targetId);
      if (!target || !livingNightLife(ctx.world, target) || !identities.get(targetId)?.isCurrent())
        continue;
      const mapping = ctx.nativeNightTargets.mappedTarget(
        () => day,
        () => targetId,
      );
      const receipt = ctx.nativeNightTargets.reflectedTarget(
        () => day,
        () => seerId,
        () => targetId,
        "check",
      );
      if (receipt && (ability.source.kind !== "native" || ability.source.role !== Role.Seer))
        throw new Error("time_consort_seer_source_invalid");
      const effectiveId = receipt?.effectiveId ?? mapping?.effectiveId ?? targetId;
      const effectiveIdentity = identities.get(effectiveId);
      if (mapping && (!mapping.isCurrent() || !effectiveIdentity?.isCurrent()))
        throw new Error("magician_inspection_target_stale");
      const inspection = resolveInspection(ctx.world, effectiveId, "camp", ctx.roleCatalog);
      if (!ctx.isCurrent()) return;
      if (
        !scope.isEligible() ||
        !identities.get(targetId)?.isCurrent() ||
        !livingNightLife(ctx.world, target) ||
        !seerTargetAllowed(ability.state, seerId, targetId) ||
        !luckyTargetAllowed(ctx.world, seerId, ability, day, "check", targetId)
      )
        continue;
      if (mapping && (!mapping.isCurrent() || !effectiveIdentity?.isCurrent()))
        throw new Error("magician_inspection_target_stale");
      if (!inspection) continue;
      const isWerewolf = inspection.camp === Camp.Wolf;
      const seerRole = ctx.world.getComponent(seerId, COMPONENT.Role);
      if (!activeNightAbility(seerRole, "seer_check", ctx.currentDay(), ability.id)) continue;
      const seerState = seerRole ? getSeerState(seerRole, ability.id) : undefined;
      if (receipt && (!receipt.isCurrent() || !effectiveIdentity?.isCurrent()))
        throw new Error("time_consort_inspection_target_stale");
      ctx.nativeNightEffects.commitReflectedTarget(receipt, day, seerId, "check");
      if (seerState) {
        SEER_STATE_SLOT.allowedWrites.recordSeerInspection(seerState, targetId, isWerewolf, inspection);
      }

      // 原状态写入后才追加咒狐提案；仍传请求目标的原 life，随后 checks／use／效果与事实的失败不撤回此前前缀。
      commitFoxInspection(ctx.world, ctx.state, target, day, () => scope.isOwnerCurrent(true));
      ctx.state.seerChecks.push({ seerId, targetId, isWerewolf, result: { ...inspection } });
      recordNightAbilityUse(ability, ctx.currentDay(), true);
      ctx.nativeNightEffects.recordModifierTarget(day, seerId, "check", () => targetId);
      ctx.nativeNightEffects.commitNativeReflection(
        "seer_check",
        ability,
        targetId,
        () => scope.life,
        () => scope.isOwnerCurrent() && !ability.disabled && !ability.deathExpired,
      );
      recordOwnNightAction(ctx.world, seerId, day, "check", targetId, false);
      ctx.events.push({
        timestamp: Date.now(),
        type: "seer_checked",
        payload: {
          actorId: seerId,
          ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
          targetId,
          isWerewolf,
          result: { ...inspection },
        },
      });
    }
  },
};

/** 预言家夜间阶段列表。 */
export const SEER_NIGHT_STAGES: NightStageHandler[] = [seerCheckStage];
