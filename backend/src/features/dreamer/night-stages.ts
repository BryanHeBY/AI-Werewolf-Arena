/**
 * 负责摄梦人对当前能力及原目标生命的行动。
 * 输入为查询给出的 actor、夜请求和合法梦目标；输出保留历史与有来源梦保护。
 * 具体状态写入和共享 use 命令仍在原 commit 位置，资格／事实顺序不变。
 * 本阶段不执行死亡波或刷新已失效目标，也不回滚已付历史。
 */
import { forcedWardenNativeTarget, openWardenNativeDelivery } from "../warden/ports";
import type { RequestLeaseTurn } from "../../domain/request-lease";
import { DREAMER_STATE_SLOT } from "./ports";
import {
  isRadiantEclipseBoard,
  captureRadiantPaidEffect,
} from "../radiant-eclipse/paid-effect-ports";
import { AliveComponent, aliveLifeVersion } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import { Phase } from "../../domain/model";
import type { TrustedNightStageHandler as NightStageHandler } from "../../engine/night/trusted-runtime";
import { recordNightAbilityUse } from "../night-abilities/inventory-ports";
import { captureNightAbilityScope } from "../night-abilities/scope-ports";
import { markDreamNightCommitted } from "./night-frame";
import { dreamNightLinksForAppend } from "./night-links";

export const DREAMER_NIGHT_STAGE: NightStageHandler = {
  id: "dreamer_action",
  priority: 150,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const { actorId, ability } of ctx.nightActors.actors("dream", day)) {
      if (!ctx.isCurrent()) return;
      const scope = captureNightAbilityScope(
        ctx.world,
        actorId,
        ability,
        day,
        () => ctx.isCurrent() && ctx.currentDay() === day,
      );
      if (!scope?.isEligible()) continue;
      const wardenForced = forcedWardenNativeTarget(ctx, actorId);
      if (wardenForced && !wardenForced.isCurrent()) throw new Error("warden_native_partner_stale");
      const actorLife = scope.life.life,
        actorVersion = scope.life.version,
        state = ability.state;
      const targets = new Map(
        ctx.world
          .getAliveEntityIds()
          .filter((id) => id !== actorId && (!wardenForced || id === wardenForced.targetId))
          .map((id) => {
            const life = ctx.world.getComponent(id, COMPONENT.Alive)!;
            return [id, { life, version: aliveLifeVersion(life) }] as const;
          }),
      );
      if (targets.size === 0) {
        if (wardenForced) throw new Error("warden_dream_no_legal_target");
        continue;
      }
      let applied = false;
      const current = () => scope.isEligible();
      for (let attempt = 1; attempt <= (wardenForced ? 1 : 3); attempt++) {
        if (!current()) {
          if (isRadiantEclipseBoard(ctx.world))
            throw new Error("radiant_eclipse_dream_scope_stale");
          break;
        }
        const request = ctx.makeRequest(actorId, ["dream"], {
          stage: "dreamer",
          ...(wardenForced
            ? {
                warden_forced_target: wardenForced.targetId,
                action_failure_policy: "error" as const,
                allow_fallback: false,
              }
            : {}),
          ability_id: ability.id,
          ...(attempt === 1 ? {} : { retry_attempt: attempt - 1, retry_max: 2 }),
        });
        if (!current()) {
          if (isRadiantEclipseBoard(ctx.world))
            throw new Error("radiant_eclipse_dream_scope_stale");
          break;
        }
        let wardenDelivery: RequestLeaseTurn | undefined,
          wardenFailed = false;
        try {
          if (wardenForced)
            wardenDelivery = openWardenNativeDelivery(
              request,
              () => current() && wardenForced.isCurrent(),
            );
          if (wardenDelivery && !wardenDelivery.current())
            throw new Error("warden_dream_request_revoked");
          const action = await ctx.actionProvider.getAction(request);
          if (wardenDelivery && !wardenDelivery.current())
            throw new Error("warden_dream_request_revoked");
          if (!current()) {
            if (isRadiantEclipseBoard(ctx.world))
              throw new Error("radiant_eclipse_dream_scope_stale");
            break;
          }
          if (action?.name !== "dream") {
            if (wardenForced) throw new Error("warden_dream_action_missing");
            if (isRadiantEclipseBoard(ctx.world))
              throw new Error("radiant_eclipse_dream_action_missing");
            continue;
          }
          const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
            phase: Phase.Night,
            day,
            abilityId: ability.id,
          });
          if (!current()) {
            if (isRadiantEclipseBoard(ctx.world))
              throw new Error("radiant_eclipse_dream_scope_stale");
            break;
          }
          if (!validated.ok || validated.sanitizedCall?.name !== "dream") {
            if (wardenForced) throw new Error("warden_dream_action_invalid");
            if (isRadiantEclipseBoard(ctx.world))
              throw new Error("radiant_eclipse_dream_action_invalid");
            continue;
          }
          const targetId = validated.sanitizedCall.args.target_id,
            target = targets.get(targetId);
          if (
            !target ||
            ctx.world.getComponent(targetId, COMPONENT.Alive) !== target.life ||
            !target.life.alive ||
            target.version === undefined ||
            aliveLifeVersion(target.life) !== target.version
          )
            continue;
          if (wardenForced && targetId !== wardenForced.targetId)
            throw new Error("warden_dream_target_invalid");
          const consecutive = state.lastDay === day - 1 && state.lastTarget === targetId;
          if (wardenDelivery && !wardenDelivery.current())
            throw new Error("warden_dream_target_revoked");
          DREAMER_STATE_SLOT.allowedWrites.recordDreamSelection(state, targetId, day);
          recordNightAbilityUse(ability, day, true);
          markDreamNightCommitted(ctx.world, day);
          applied = true;
          // 历史、次数与开夜提交已经落下；先取本族同数组的 push，再构造原生命／已付效果条目。
          // 原已付 predicate 在这个字段位置才捕获；不能用仍开放的行动 scope 替代它或重付资源。
          dreamNightLinksForAppend(ctx.state).push({
            actorId,
            targetId,
            day,
            isCurrent: captureRadiantPaidEffect(ctx.world, day, actorId, ability, targetId),
            consecutive,
            protectionPolicy: state.protectionPolicy,
            actorLife,
            actorVersion,
            targetLife: target.life,
            targetVersion: target.version,
            ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
          });
          ctx.events.push({
            timestamp: Date.now(),
            type: "dream_applied",
            payload: {
              actorId,
              targetId,
              day,
              consecutive,
              ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
            },
          });
          wardenDelivery?.complete();
          break;
        } catch (error) {
          wardenFailed = true;
          throw error;
        } finally {
          try {
            wardenDelivery?.close();
          } catch (error) {
            if (!wardenFailed) throw error;
          }
        }
      }
      if (
        !applied &&
        current() &&
        [...targets].some(
          ([id, target]) =>
            ctx.world.getComponent(id, COMPONENT.Alive) === target.life &&
            target.life.alive &&
            target.version !== undefined &&
            aliveLifeVersion(target.life) === target.version,
        )
      )
        throw new Error("dream_required_action_missing");
    }
  },
};

/** 模块定义完成时固定完整原程序引用；后来替换 execute 不能借原 handler 对象取得私有输入。这里不持有运行 World。 */
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze(
  [DREAMER_NIGHT_STAGE].map((handler) => Object.freeze([handler, handler.execute] as const)),
);
