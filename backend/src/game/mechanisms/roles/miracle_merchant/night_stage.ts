/**
 * 负责奇迹商人从实际库存选择赠予。输入为当前原体与验证后的技能／收货选择，输出为赠予、反噬及交易事实。
 * 阵营只在原点晚查实际值，同值组件替换不增加引用撤权；新请求、关窗或首付款之前拒绝已退休源。
 * 原 ownerCurrent 仍复验已付反噬的生命与身份，目标／知识不按运行墓碑裁剪。Good 授予正常返回后，
 * 商人库存、成交记录和事实仍按原完成前缀继续；Wolf 在商人库存首写付款，异常不退款或回滚。
 */
import { closeMerchantTrade, recordMerchantTrade } from "./state";

import type { MiracleSkill } from "@ai-werewolf-arena/game-contract";

import { COMPONENT } from "../../../../domain/components/names";
import { isRoleExecutionRetired } from "../../../../domain/role-execution-authority";
import type { RoleComponent } from "../../../../domain/components/role";
import { Camp, Role, Phase, WitchSelfHealRule, type ToolCall } from "../../../../domain/model";
import { captureNightLife, livingNightLife } from "../../../../domain/night-effects";
import type { World } from "../../../../domain/world";
import type { NightStageHandler } from "../../stages/night/contracts";
import { grantNightAbility } from "../night-ability-grants";
import { canMerchantTrade, getMerchantState } from "./state";

const committed = new WeakMap<World, Set<number>>();
export function hasMerchantNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
function recordCommit(world: World, day: number): void {
  const days = committed.get(world) ?? new Set<number>();
  days.add(day);
  committed.set(world, days);
}

export const MIRACLE_MERCHANT_STAGE: NightStageHandler = {
  id: "miracle_merchant",
  priority: 125,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const actorId of ctx.getAliveByRole(Role.MiracleMerchant)) {
      const role = ctx.world.getComponent(actorId, COMPONENT.Role)!,
        state = getMerchantState(role),
        life = captureNightLife(ctx.world, actorId);
      if (!state || !life || ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Good) continue;
      const privateState = role.privateState;
      const ownerCurrent = () =>
        ctx.isCurrent() &&
        ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.MiracleMerchant &&
        ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp === Camp.Good &&
        role.privateState === privateState &&
        getMerchantState(role) === state &&
        livingNightLife(ctx.world, life);
      // 先完成原体／库存的原有序复验，再否决新交易；纯 ownerCurrent 仍供已付反噬使用。
      const current = () => ownerCurrent() && canMerchantTrade(state, day) && !isRoleExecutionRetired(role);
      if (!current()) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
        const targets = new Map(
          ctx.world
            .getAliveEntityIds()
            .filter((id) => id !== actorId)
            .map((id) => {
              const targetRole = ctx.world.getComponent(id, COMPONENT.Role)!;
              return [
                id,
                {
                  life: captureNightLife(ctx.world, id)!,
                  role: targetRole,
                  kind: targetRole.role,
                  camp: ctx.world.getComponent(id, COMPONENT.Camp)?.camp,
                  privateState: targetRole.privateState,
                },
              ] as const;
            }),
        );
        // 候选捕获的原 getter 已全部执行；退休源不再打开新的请求，目标名单本身不按墓碑过滤。
        if (isRoleExecutionRetired(role)) break;
        let action: ToolCall | null = null;
        if (targets.size) {
          // 保原 receiver／getAction callee → makeRequest callee → 请求实参的求值序；不提前要求原 callee 可调用。
          const provider = ctx.actionProvider,
            getAction = provider.getAction,
            makeRequest = ctx.makeRequest,
            requestArgs = [actorId, ["bestow_ability"], {
              stage: "miracle_merchant",
              requiresAction: false,
              ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
            }],
            invoke = Reflect.apply.bind(Reflect);
          // 新 Reflect／bind 查找与分配都先完成；末旗后只裸调用已准备 invoker，不再查方法属性。
          if (isRoleExecutionRetired(role)) break;
          const request = invoke(makeRequest, ctx, requestArgs), actionArgs = [request];
          // builder 已完成的请求前缀不回滚；它退休源时不再调用 provider，await 后仍走原 current。
          if (isRoleExecutionRetired(role)) break;
          action = await invoke(getAction, provider, actionArgs);
        }
        if (!current()) break;
        if (action === null) {
          // 空回复也会写当日关窗；只在首写之前拒绝，既有 callee 和局部实参顺序不改。
          const closeTrade = closeMerchantTrade;
          if (isRoleExecutionRetired(role)) break;
          closeTrade(state, day);
          recordCommit(ctx.world, day);
          ctx.events.push({
            timestamp: Date.now(),
            type: "merchant_trade_skipped",
            payload: { actorId, day },
          });
          completed = true;
          break;
        }
        if (action.name !== "bestow_ability") continue;
        const valid = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (!current() || !valid.ok || valid.sanitizedCall?.name !== "bestow_ability") continue;
        const { target_id: targetId, skill } = valid.sanitizedCall.args,
          target = targets.get(targetId);
        if (
          !target ||
          !livingNightLife(ctx.world, target.life) ||
          ctx.world.getComponent(targetId, COMPONENT.Role) !== target.role ||
          target.role.role !== target.kind ||
          ctx.world.getComponent(targetId, COMPONENT.Camp)?.camp !== target.camp ||
          target.role.privateState !== target.privateState
        )
          continue;
        const failure = target.camp === Camp.Wolf;
        // 原 args／目标末字段与阵营判断已完成；Wolf 在 record 内首付，Good 由原赠予 owner 首装。
        if (isRoleExecutionRetired(role)) break;
        if (!failure) {
          const base = {
            id: "gift:miracle",
            activation: "lucky" as const,
            source: { kind: "gift" as const, actorId },
            sourceDisclosed: false,
            startsOnDay: day,
            maxUses: 1,
          };
          if (skill === "check") {
            const grant = grantNightAbility,
              grantArgs: Parameters<typeof grantNightAbility<"seer_check">> = [
                ctx.world,
                targetId,
                {
                  ...base,
                  kind: "seer_check",
                  state: { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] },
                },
                ctx.events,
              ],
              grantWorld = grantArgs[0], grantTarget = grantArgs[1], grantInput = grantArgs[2], grantEvents = grantArgs[3];
            // 原 callee 与全部 World／payload／events 实参已经求值；共同资源 owner 不能替代本阶段捕获源的末拒绝。
            if (isRoleExecutionRetired(role)) break;
            grant(grantWorld, grantTarget, grantInput, grantEvents);
          }
          if (skill === "guard") {
            const grant = grantNightAbility,
              grantArgs: Parameters<typeof grantNightAbility<"guard">> = [
                ctx.world,
                targetId,
                { ...base, kind: "guard", state: { lastTarget: null } },
                ctx.events,
              ],
              grantWorld = grantArgs[0], grantTarget = grantArgs[1], grantInput = grantArgs[2], grantEvents = grantArgs[3];
            // 原 callee 与全部 World／payload／events 实参已经求值；共同资源 owner 不能替代本阶段捕获源的末拒绝。
            if (isRoleExecutionRetired(role)) break;
            grant(grantWorld, grantTarget, grantInput, grantEvents);
          }
          if (skill === "poison") {
            const grant = grantNightAbility,
              grantArgs: Parameters<typeof grantNightAbility<"potion">> = [
                ctx.world,
                targetId,
                {
                  ...base,
                  kind: "potion",
                  state: {
                    heal: 0,
                    poison: 1,
                    selfHealRule: WitchSelfHealRule.Disabled,
                    canSelfHeal: false,
                    healUsedThisNight: false,
                    poisonUsedThisNight: false,
                  },
                },
                ctx.events,
              ],
              grantWorld = grantArgs[0], grantTarget = grantArgs[1], grantInput = grantArgs[2], grantEvents = grantArgs[3];
            // 原 callee 与全部 World／payload／events 实参已经求值；共同资源 owner 不能替代本阶段捕获源的末拒绝。
            if (isRoleExecutionRetired(role)) break;
            grant(grantWorld, grantTarget, grantInput, grantEvents);
          }
        }
        // Good 授予正常返回后属于已接受前缀；不以晚退休截断商人库存、记录和事实，原抛错仍传播。
        const recordTrade = recordMerchantTrade;
        if (failure && isRoleExecutionRetired(role)) break;
        recordTrade(state, day, targetId, skill as MiracleSkill);
        recordCommit(ctx.world, day);
        if (failure)
          (ctx.state.merchantBacklashes ??= []).push({ target: life, isCurrent: ownerCurrent });
        ctx.events.push({
          timestamp: Date.now(),
          type: "merchant_trade_committed",
          payload: { actorId, day, targetId, skill },
        });
        ctx.events.push({
          timestamp: Date.now(),
          type: "merchant_trade_resolved",
          payload: { actorId, day, targetId, skill, outcome: failure ? "backlash" : "granted" },
        });
        completed = true;
        break;
      }
      if (!completed && current()) throw new Error("merchant_valid_action_missing");
    }
  },
};
