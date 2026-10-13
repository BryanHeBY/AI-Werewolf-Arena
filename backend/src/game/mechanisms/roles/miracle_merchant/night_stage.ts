/**
 * Runs Miracle Merchant gift selection from the actual merchant stock. Inputs are current bodies
 * and the validated skill/recipient choice; outputs are owned grants, backlash claims and
 * skip/commit evidence. Paid claims keep their original-life validity and never transfer to a
 * replacement giver.
 */
import { closeMerchantTrade, recordMerchantTrade } from "./state";

import type { MiracleSkill } from "@ai-werewolf-arena/game-contract";

import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, Phase, WitchSelfHealRule } from "../../../../core/domain/model";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import type { NightStageHandler } from "../../stages/night/contracts";
import { grantNightAbility } from "../ability_changes";
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
      if (!state || !life || role.camp !== Camp.Good) continue;
      const privateState = role.privateState;
      const ownerCurrent = () =>
        ctx.isCurrent() &&
        ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.MiracleMerchant &&
        role.camp === Camp.Good &&
        role.privateState === privateState &&
        getMerchantState(role) === state &&
        livingNightLife(ctx.world, life);
      const current = () => ownerCurrent() && canMerchantTrade(state, day);
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
                  camp: targetRole.camp,
                  privateState: targetRole.privateState,
                },
              ] as const;
            }),
        );
        const action = targets.size
          ? await ctx.actionProvider.getAction(
              ctx.makeRequest(actorId, ["bestow_ability"], {
                stage: "miracle_merchant",
                requiresAction: false,
                ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
              }),
            )
          : null;
        if (!current()) break;
        if (action === null) {
          closeMerchantTrade(state, day);
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
          target.role.camp !== target.camp ||
          target.role.privateState !== target.privateState
        )
          continue;
        const failure = target.camp === Camp.Wolf;
        if (!failure) {
          const base = {
            id: "gift:miracle",
            activation: "lucky" as const,
            source: { kind: "gift" as const, actorId },
            sourceDisclosed: false,
            startsOnDay: day,
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
          if (skill === "guard")
            grantNightAbility(
              ctx.world,
              targetId,
              { ...base, kind: "guard", state: { lastTarget: null } },
              ctx.events,
            );
          if (skill === "poison")
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
        recordMerchantTrade(state, day, targetId, skill as MiracleSkill);
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
