/**
 * 负责普通预言家对捕获能力及目标权威的查验请求。
 * 输入为原夜上下文和校验行动；输出保留查验结果、状态、use 和事件效果。
 * 资格枚举走只读查询，具体 Seer 状态与公共 use 命令在原 commit 位置执行；映射与咒狐顺序不变。
 * 普通请求以 F02 租约约束信封／能力和期限，全部领域写入完成后才结算，晚事实失败不退款。
 * Demon 封存原生控制器保持独立，不把原体或运行完成端口写入玩家知识。
 */
import { forcedWardenNativeTarget } from "../warden/ports";
import { SEER_STATE_SLOT } from "./ports";
import { openNativeNightRequestDelivery } from "../../engine/night/native-request-lease";
import type { RequestLeaseTurn } from "../../domain/request-lease";
/** 文件说明：预言家夜间查验阶段处理。 */
import { seerTargetAllowed } from "./ports";
import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { Camp, Phase, Role } from "../../domain/model";
import type { TrustedNightStageHandler as NightStageHandler } from "../../engine/night/trusted-runtime";
import { getSeerState } from "./ports";
import { resolveInspection } from "../../engine/inspection";
import { activeNightAbility } from "../night-abilities/inventory-ports";
import { recordNightAbilityUse } from "../night-abilities/inventory-ports";
import { captureNightAbilityScope } from "../night-abilities/scope-ports";
import { captureNightLife, livingNightLife } from "../../domain/night-effects";
import { recordOwnNightAction, luckyTargetAllowed } from "../night-abilities/history-ports";

import { captureInspectionIdentity, commitFoxInspection } from "../cursed-fox/inspection-ports";

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
      const wardenForced = forcedWardenNativeTarget(ctx, seerId);
      if (wardenForced && !wardenForced.isCurrent()) throw new Error("warden_native_partner_stale");
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
            (!wardenForced || id === wardenForced.targetId) &&
            seerTargetAllowed(ability.state, seerId, id) &&
            luckyTargetAllowed(ctx.world, seerId, ability, day, "check", id),
        );
      if (!legalTargets.length) {
        if (wardenForced) throw new Error("warden_seer_no_legal_target");
        continue;
      }
      let delivery: RequestLeaseTurn | undefined;
      let failed = false;
      try {
        // 在原 ability_id 参数求值点保存同一读数；新初次关联不额外读取能力或 World。
        let requestAbilityId: string;
        const req = ctx.makeRequest(seerId, ["check_identity"], {
          stage: "seer",
          ...(wardenForced
            ? {
                warden_forced_target: wardenForced.targetId,
                action_failure_policy: "error" as const,
                allow_fallback: false,
              }
            : {}),
          ability_id: (requestAbilityId = ability.id),
          requiresAction: ability.state.actionPolicy !== "awa_optional_v1",
        });
        if (!scope.isEligible()) {
          ctx.nativeNightFailure.scopeStale("seer");
          continue;
        }
        delivery = openNativeNightRequestDelivery(
          {
            actorId: seerId,
            day,
            stage: "seer",
            abilityId: requestAbilityId,
            current: () => scope.isEligible() && (!wardenForced || wardenForced.isCurrent()),
          },
          req,
        );
        if (!delivery) continue;
        // 原 provider 对象／callee／参数及新增 Reflect 准备先求值；末守卫后只裸调用，保 receiver 与非函数调用错误时点。
        const provider = ctx.actionProvider;
        const getAction = provider.getAction;
        const actionArguments: [typeof req] = [req];
        const invokeAction = Reflect.apply.bind(Reflect);
        if (!delivery.current()) continue;
        const action = await invokeAction(getAction, provider, actionArguments);
        if (!ctx.isCurrent()) return;
        if (!scope.isEligible()) {
          ctx.nativeNightFailure.scopeStale("seer");
          continue;
        }
        if (!delivery.current()) continue;
        if (action?.name !== "check_identity") {
          if (wardenForced) throw new Error("warden_seer_action_missing");
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
        if (!delivery.current()) continue;
        if (!result.ok || !result.sanitizedCall) {
          if (wardenForced) throw new Error("warden_seer_action_invalid");
          ctx.nativeNightFailure.actionInvalid("seer");
          continue;
        }

        const targetId = result.sanitizedCall.args.target_id;
        if (wardenForced && targetId !== wardenForced.targetId)
          throw new Error("warden_seer_target_invalid");
        const target = targets.get(targetId);
        if (
          !target ||
          !livingNightLife(ctx.world, target) ||
          !identities.get(targetId)?.isCurrent()
        )
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
        // 反射提交是原同步提交前缀的起点；保原 effects/callee/参数先后，并在全部新增可执行准备之后作最后交付核验。
        const effects = ctx.nativeNightEffects;
        const commitReflectedTarget = effects.commitReflectedTarget;
        const reflectedArguments: [typeof receipt, number, number, "check"] = [
          receipt,
          day,
          seerId,
          "check",
        ];
        const invokeReflectedTarget = Reflect.apply.bind(Reflect);
        if (wardenForced && (!wardenForced.isCurrent() || targetId !== wardenForced.targetId))
          throw new Error("warden_seer_target_revoked");
        if (!delivery.current()) continue;
        invokeReflectedTarget(commitReflectedTarget, effects, reflectedArguments);
        if (seerState) {
          SEER_STATE_SLOT.allowedWrites.recordSeerInspection(
            seerState,
            targetId,
            isWerewolf,
            inspection,
          );
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
        // 此前状态、咒狐、checks、use、modifier、反射及自身历史都已成功；此后不能再以 isEligible 否决已付结果。
        // complete 先终结再通知，通知或晚 seer_checked 发表抛错也不回滚前缀、不二次 false。
        delivery.complete();
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
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        // 部分写入正常保留；已有正文错误（包括 throw undefined）优先于新增 false 通知错误。
        if (failed) {
          try {
            delivery?.close();
          } catch {
            /* 保留正在传播的原正文错误。 */
          }
        } else {
          delivery?.close();
        }
      }
    }
  },
};

/** 预言家夜间阶段列表。 */
export const SEER_NIGHT_STAGES: NightStageHandler[] = [seerCheckStage];

/** 模块定义完成时固定完整原程序引用；后来替换 execute 不能借原 handler 对象取得私有输入。这里不持有运行 World。 */
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze(
  [...SEER_NIGHT_STAGES].map((handler) => Object.freeze([handler, handler.execute] as const)),
);
