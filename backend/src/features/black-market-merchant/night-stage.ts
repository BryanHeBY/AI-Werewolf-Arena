/**
 * 负责黑市商人在后置受赠行动之前选择交易。输入为原库存与已验证的技能／收货，输出为独立 gift／gun、反噬和事实。
 * 阵营保原捕获／复验点的实际 Camp 值，新请求和未付关窗／首付款之前拒绝退休源，不改变纯目标与知识名单。
 * ownerCurrent（含 paid 首死分支）保已付反噬的原身份／生命政策；Good 资源授予正常返回或 Wolf 首库存写后，
 * 其余库存、选择、记录和事实仍按原前缀完成，原异常传播且不退款，不给替换商人接续已付效果。
 */
import { closeBlackMarketTrade, recordBlackMarketTrade } from "./state";

import { COMPONENT } from "../../domain/components/names";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import type { RoleComponent } from "../../domain/components/role";
import { Camp, Role, Phase, WitchSelfHealRule, type ToolCall } from "../../domain/model";
import { aliveLifeVersion } from "../../domain/components/alive";
import { captureNightLife, livingNightLife } from "../../domain/night-effects";
import type { World } from "../../domain/world";
import type { NightStageHandler } from "../../engine/night/contracts";
import { grantNightAbility } from "../night-abilities/night-ability-grants";
import { grantDeathGun } from "../death-actions/death-abilities";
import { recipientAbilityStage } from "../night-abilities/recipient-ability-stage";
import { canBlackMarketTrade, getBlackMarketState } from "./state";
const committed = new WeakMap<World, Set<number>>();
export function hasBlackMarketNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
function recordCommit(world: World, day: number): void {
  const days = committed.get(world) ?? new Set<number>();
  days.add(day);
  committed.set(world, days);
}
export const BLACK_MARKET_RECIPIENT_STAGE = recipientAbilityStage("black_market", 140);
export const BLACK_MARKET_TRADE_STAGE: NightStageHandler = {
  id: "black_market_merchant",
  priority: 130,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const actorId of ctx.getAliveByRole(Role.BlackMarketMerchant)) {
      const role = ctx.world.getComponent(actorId, COMPONENT.Role)!,
        state = getBlackMarketState(role),
        life = captureNightLife(ctx.world, actorId);
      if (!state || !life || ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Good) continue;
      const privateState = role.privateState;
      const ownerCurrent = (paid = false) =>
        ctx.isCurrent() &&
        ctx.currentDay() === day &&
        ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.BlackMarketMerchant &&
        ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp === Camp.Good &&
        role.privateState === privateState &&
        getBlackMarketState(role) === state &&
        (livingNightLife(ctx.world, life) ||
          (paid &&
            ctx.world.getComponent(actorId, COMPONENT.Alive) === life.life &&
            !life.life.alive &&
            aliveLifeVersion(life.life) === life.version + 1));
      // 先完成原体／库存的原有序复验，再否决新交易；纯 ownerCurrent 仍供已付反噬使用。
      const current = () => ownerCurrent() && canBlackMarketTrade(state, day) && !isRoleExecutionRetired(role);
      if (!current()) continue;
      const skip = () => {
        // null 或原无目标收尾都只是未付关窗；最后一次候选查询能退休源，故在关闭首写前单独拒绝。
        const closeTrade = closeBlackMarketTrade;
        if (isRoleExecutionRetired(role)) return;
        closeTrade(state, day);
        recordCommit(ctx.world, day);
        ctx.events.push({
          timestamp: Date.now(),
          type: "black_market_trade_skipped",
          payload: { actorId, day },
        });
      };
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
            requestArgs = [actorId, ["black_market_trade"], {
              stage: "black_market_merchant",
              requiresAction: false,
              action_failure_policy: "error",
              allow_fallback: false,
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
          skip();
          completed = true;
          break;
        }
        if (action.name !== "black_market_trade") continue;
        const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (!current() || !validated.ok || validated.sanitizedCall?.name !== "black_market_trade")
          continue;
        const { target_id: targetId, skill } = validated.sanitizedCall.args,
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
        if (target.camp !== Camp.Good && target.camp !== Camp.Wolf)
          throw new Error("black_market_target_camp_unsupported");
        const failed = target.camp === Camp.Wolf;
        // 原目标 getter／unsupported-Camp 错误仍先发生；只在 Wolf 首付或 Good 资源授予之前拒绝退休源。
        if (isRoleExecutionRetired(role)) break;
        if (!failed) {
          if (skill === "gun") {
            const grant = grantDeathGun,
              grantArgs: Parameters<typeof grantDeathGun> = [ctx.world, actorId, targetId, day, ctx.events],
              grantWorld = grantArgs[0], grantActor = grantArgs[1], grantTarget = grantArgs[2],
              grantDay = grantArgs[3], grantEvents = grantArgs[4];
            // 五个原实参含 World／events 的 getter 均先执行；源退休时不让另一 World 的 common 校验代替本旗。
            if (isRoleExecutionRetired(role)) break;
            grant(grantWorld, grantActor, grantTarget, grantDay, grantEvents);
          }
          else {
            const base = {
              id: "gift:black-market",
              activation: "black_market" as const,
              source: { kind: "gift" as const, actorId },
              sourceDisclosed: false,
              startsOnDay: day + 1,
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
            } else {
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
        }
        // Good gift／gun 正常返回后不再加墓碑；晚退休不能取消商人库存与已付反噬／通知完成前缀。
        const recordTrade = recordBlackMarketTrade;
        if (failed && isRoleExecutionRetired(role)) break;
        recordTrade(state, day, targetId, skill);
        recordCommit(ctx.world, day);
        const choice = state.choice!;
        if (failed)
          (ctx.state.blackMarketBacklashes ??= []).push({
            target: life,
            isCurrent: () =>
              ownerCurrent(true) &&
              state.choice === choice &&
              choice.day === day &&
              choice.targetId === targetId &&
              choice.skill === skill,
          });
        ctx.events.push({
          timestamp: Date.now(),
          type: "black_market_trade_committed",
          payload: { actorId, day, targetId, skill },
        });
        ctx.events.push({
          timestamp: Date.now(),
          type: "black_market_trade_resolved",
          payload: { actorId, day, targetId, skill, outcome: failed ? "backlash" : "granted" },
        });
        completed = true;
        break;
      }
      if (!completed && current()) {
        if (ctx.world.getAliveEntityIds().some((id) => id !== actorId))
          throw new Error("black_market_valid_action_missing");
        skip();
      }
    }
  },
};
