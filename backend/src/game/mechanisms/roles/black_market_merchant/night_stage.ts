/**
 * 负责黑市商人在后置受赠行动之前的交易阶段。输入为当前商人库存与已验证的技能／收货选择；
 * 阵营在原捕获／复验点取真实 Camp 值；已付反噬 owner 保原谓词，不混入新执行退休。
 * 输出为独立受赠能力或赠枪、反噬提案和跳过／提交事实。已付效果仍绑定原生命，不转给替换商人。
 */
import { closeBlackMarketTrade, recordBlackMarketTrade } from "./state";

import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, Phase, WitchSelfHealRule } from "../../../../core/domain/model";
import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import type { NightStageHandler } from "../../stages/night/contracts";
import { grantNightAbility } from "../night-ability-grants";
import { grantDeathGun } from "../death_abilities";
import { recipientAbilityStage } from "../recipient_ability_stage";
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
      const current = () => ownerCurrent() && canBlackMarketTrade(state, day);
      if (!current()) continue;
      const skip = () => {
        closeBlackMarketTrade(state, day);
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
        const action = targets.size
          ? await ctx.actionProvider.getAction(
              ctx.makeRequest(actorId, ["black_market_trade"], {
                stage: "black_market_merchant",
                requiresAction: false,
                action_failure_policy: "error",
                allow_fallback: false,
                ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
              }),
            )
          : null;
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
        if (!failed) {
          if (skill === "gun") grantDeathGun(ctx.world, actorId, targetId, day, ctx.events);
          else {
            const base = {
              id: "gift:black-market",
              activation: "black_market" as const,
              source: { kind: "gift" as const, actorId },
              sourceDisclosed: false,
              startsOnDay: day + 1,
              maxUses: 1,
            };
            if (skill === "check")
              grantNightAbility(
                ctx.world,
                targetId,
                {
                  ...base,
                  kind: "seer_check",
                  state: { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] },
                },
                ctx.events,
              );
            else
              grantNightAbility(
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
              );
          }
        }
        recordBlackMarketTrade(state, day, targetId, skill);
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
