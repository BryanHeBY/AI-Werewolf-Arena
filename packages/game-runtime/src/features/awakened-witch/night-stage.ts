/**
 * 负责觉醒女巫真实夜请求和本次协助组的秘密交流/表决。输入是可信夜运行，输出真实付款与typed毒/救提案。
 * 调毒先消耗资源，讨论顺序固定，批准在全请求冻结后并发等待；任何一人的失败不撤另一人的已付回执。
 * 请求完成与历史付款同属本族，工具返回不是完成；finally仅关闭未付交付，原业务异常优先。
 */
import {
  Phase,
  StatusMark,
  type ActionRequest,
  type ToolCall,
  type Role,
} from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_WITCH_POLICY,
  AWAKENED_WITCH_ROLE_ID,
} from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import { RequestLease, type RequestLeaseTurn } from "../../domain/request-lease";
import { originalPoisonIntent } from "../../domain/night-effects";
import type {
  TrustedNightStageHandler,
  TrustedNightStageRuntime,
} from "../../engine/night/trusted-runtime";
import {
  openAwakenedWitchNight,
  closeAwakenedWitchNight,
  awakenedWitchNightCurrent,
  awakenedWitchOptions,
  commitAwakenedBrew,
  awakenedBrewParticipants,
  awakenedBrewDiscussionCurrent,
  awakenedBrewApprovalCurrent,
  commitBrewDiscussion,
  commitBrewApproval,
  finalizeAwakenedBrew,
  prepareAwakenedBrewPoisonScope,
  awakenedWitchPaidHealScope,
} from "./authority";
import { bindAwakenedWitchHeal } from "./heal-ports";
interface Scope {
  actorId: number;
  day: number;
  current(): boolean;
}
function window(
  stage: "awakened_witch" | "brew_discussion" | "brew_approval",
  order: number,
  key: string,
) {
  return RequestLease.window<Scope>(
    {
      actorId: (s) => s.actorId,
      day: (s) => s.day,
      phase: () => Phase.Night,
      stage: () => stage,
      current: (s) => s.current(),
    },
    order,
    [key, "action_failure_policy", "allow_fallback"],
  );
}
const choices = window("awakened_witch", 210, "awakened_brew_options"),
  discussions = window("brew_discussion", 211, "brew_collaboration"),
  approvals = window("brew_approval", 212, "brew_collaboration");
async function validated(
  ctx: TrustedNightStageRuntime,
  request: ActionRequest,
  delivery: RequestLeaseTurn,
  day: number,
): Promise<ToolCall> {
  const provider = ctx.actionProvider,
    callee = provider.getAction,
    invoke = Reflect.apply.bind(Reflect),
    args: [ActionRequest] = [request];
  if (!delivery.current()) throw new Error("awakened_witch_request_revoked");
  const action = (await invoke(callee, provider, args)) as ToolCall | null;
  if (!delivery.current()) throw new Error("awakened_witch_request_revoked");
  if (!action || !request.allowedTools.includes(action.name))
    throw new Error("awakened_witch_action_missing");
  const result = ctx.toolGateway.validateAndSanitize(ctx.world, request.actorId, action, {
    phase: Phase.Night,
    day,
  });
  if (!delivery.current()) throw new Error("awakened_witch_request_revoked");
  if (
    !result.ok ||
    !result.sanitizedCall ||
    !request.allowedTools.includes(result.sanitizedCall.name)
  )
    throw new Error("awakened_witch_action_invalid");
  return result.sanitizedCall;
}
export const AWAKENED_WITCH_NIGHT_STAGE: TrustedNightStageHandler = {
  id: "awakened_witch",
  priority: 600,
  async execute(ctx) {
    const actors = ctx.getAliveByRole(AWAKENED_WITCH_ROLE_ID as Role);
    if (!actors.length) return;
    if (actors.length !== 1) throw new Error("awakened_witch_actor_count_invalid");
    const actorId = actors[0]!,
      day = ctx.currentDay();
    openAwakenedWitchNight(ctx.world, actorId, day, ctx.state.wolfTarget);
    const deliveries: RequestLeaseTurn[] = [];
    const current = () => ctx.isCurrent() && ctx.currentDay() === day;
    let failed = false;
    try {
      const options = awakenedWitchOptions(ctx.world, actorId, day);
      if (!options) throw new Error("awakened_witch_options_missing");
      const request = ctx.makeRequest(actorId, ["awakened_brew"], {
          stage: "awakened_witch",
          requiresAction: true,
          action_failure_policy: "error",
          allow_fallback: false,
          awakened_brew_options: options,
        }),
        scope = {
          actorId,
          day,
          current: () => current() && awakenedWitchNightCurrent(ctx.world, actorId, day),
        };
      choices.bind(scope, request);
      const delivery = choices.openDelivery(scope, request);
      if (!delivery) throw new Error("awakened_witch_request_revoked");
      deliveries.push(delivery);
      const call = await validated(ctx, request, delivery, day);
      if (call.name !== "awakened_brew") throw new Error("awakened_brew_missing");
      const choice = {
        mode: call.args.mode,
        targetId: call.args.target_id,
        assistantIds: call.args.assistant_ids,
      };
      // 救治的目标及真实marks/callee在付款前准备，捕获过程撤权也不能消耗解药。
      const marks = choice.mode === "heal" ? ctx.ensureMarks(choice.targetId!) : null,
        add = marks?.add,
        invoke = Reflect.apply.bind(Reflect);
      const row = commitAwakenedBrew(ctx.world, actorId, day, choice, () => delivery.current());
      delivery.complete();
      if (row.mode === "heal") {
        const heal = awakenedWitchPaidHealScope(ctx.world, day);
        if (!heal || !heal.isCurrent() || !marks || !add)
          throw new Error("awakened_witch_heal_revoked");
        // 历史已付在先，随后真实印记/提案任一步失败均保留解药消耗，不声称跨回调原子。
        invoke(add, marks, [StatusMark.HealMark]);
        bindAwakenedWitchHeal(ctx.state, { target: heal.target, marks, isCurrent: heal.isCurrent });
      }
      ctx.events.push({
        timestamp: Date.now(),
        type: "awakened_brew_chosen",
        payload: {
          policy: AWAKENED_WITCH_POLICY,
          actorId,
          day,
          mode: row.mode,
          targetId: row.mode === "pass" ? null : row.targetId,
          assistantIds: row.mode === "poison" ? [...row.assistantIds] : [],
          ordinal: row.mode === "poison" ? row.ordinal : null,
        },
        audience: Object.freeze([actorId]),
      });
      if (row.mode !== "poison") return;
      const group = awakenedBrewParticipants(ctx.world, day);
      if (!group) throw new Error("awakened_brew_group_revoked");
      const audience = Object.freeze([...group.assistantIds]);
      ctx.events.push({
        timestamp: Date.now(),
        type: "brew_started",
        payload: { policy: AWAKENED_WITCH_POLICY, day, ...group },
        audience,
      });
      for (const id of group.assistantIds) {
        const request = ctx.makeRequest(id, ["brew_discuss"], {
            stage: "brew_discussion",
            requiresAction: true,
            action_failure_policy: "error",
            allow_fallback: false,
            brew_collaboration: { ...group, assistantIds: [...group.assistantIds] },
          }),
          scope = {
            actorId: id,
            day,
            current: () => current() && awakenedBrewDiscussionCurrent(ctx.world, id, day),
          };
        discussions.bind(scope, request);
        const delivery = discussions.openDelivery(scope, request);
        if (!delivery) throw new Error("awakened_brew_discussion_revoked");
        deliveries.push(delivery);
        const call = await validated(ctx, request, delivery, day);
        if (call.name !== "brew_discuss") throw new Error("awakened_brew_discussion_missing");
        const raw = call.args.text;
        commitBrewDiscussion(ctx.world, id, day, raw, () => delivery.current());
        delivery.complete();
        ctx.events.push({
          timestamp: Date.now(),
          type: "brew_discussion",
          payload: {
            policy: AWAKENED_WITCH_POLICY,
            day,
            ordinal: group.ordinal,
            actorId: id,
            text: raw,
          },
          audience,
        });
      }
      // 所有独立请求先创建，visible_events不含批准票；各自付款不等待别人的返回。
      const pending = group.assistantIds.map((id) => {
        const request = ctx.makeRequest(id, ["brew_approve"], {
            stage: "brew_approval",
            requiresAction: true,
            action_failure_policy: "error",
            allow_fallback: false,
            brew_collaboration: { ...group, assistantIds: [...group.assistantIds] },
          }),
          scope = {
            actorId: id,
            day,
            current: () => current() && awakenedBrewApprovalCurrent(ctx.world, id, day),
          };
        approvals.bind(scope, request);
        const delivery = approvals.openDelivery(scope, request);
        if (!delivery) throw new Error("awakened_brew_approval_revoked");
        deliveries.push(delivery);
        return { id, request, delivery, accepted: null as boolean | null };
      });
      const results = await Promise.allSettled(
        pending.map(async (p) => {
          const call = await validated(ctx, p.request, p.delivery, day);
          if (call.name !== "brew_approve") throw new Error("awakened_brew_approval_missing");
          const approve = call.args.approve;
          commitBrewApproval(ctx.world, p.id, day, approve, () => p.delivery.current());
          p.accepted = approve;
          p.delivery.complete();
        }),
      );
      const rejection = results.find((r) => r.status === "rejected");
      try {
        for (const p of pending)
          if (p.accepted !== null)
            ctx.events.push({
              timestamp: Date.now(),
              type: "brew_approval",
              payload: {
                policy: AWAKENED_WITCH_POLICY,
                day,
                ordinal: group.ordinal,
                actorId: p.id,
                approve: p.accepted,
              },
              audience: Object.freeze([p.id]),
            });
      } catch (error) {
        if (rejection?.status === "rejected") throw rejection.reason;
        throw error;
      }
      if (rejection?.status === "rejected") throw rejection.reason;
      const poison = prepareAwakenedBrewPoisonScope(ctx.world, day);
      if (!poison) throw new Error("awakened_brew_poison_scope_missing");
      const claim = originalPoisonIntent(
          { source: poison.actor, target: poison.target, isCurrent: poison.isCurrent },
          {
            family: "awakened-witch",
            stage: "awakened_witch",
            day,
            actorLife: poison.actor,
            requestedTargetId: group.targetId,
            abilityId: "native:awakened_witch",
          },
        ),
        claims = ctx.state.poisonClaims,
        append = claims?.push;
      if (!claims || !append) throw new Error("awakened_brew_poison_sink_missing");
      const poisonMarks = pending.every((p) => p.accepted === true)
          ? ctx.ensureMarks(group.targetId)
          : null,
        addPoison = poisonMarks?.add;
      const outcome = finalizeAwakenedBrew(ctx.world, day, current);
      if (outcome === "poison") {
        if (!poisonMarks || !addPoison) throw new Error("awakened_brew_poison_marks_missing");
        invoke(addPoison, poisonMarks, [StatusMark.PoisonMark]);
        invoke(append, claims, [claim]);
      }
      ctx.events.push({
        timestamp: Date.now(),
        type: "brew_resolved",
        payload: {
          policy: AWAKENED_WITCH_POLICY,
          day,
          ordinal: group.ordinal,
          actorId,
          targetId: group.targetId,
          assistantIds: [...group.assistantIds],
          outcome,
        },
        audience: Object.freeze([]),
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      closeAwakenedWitchNight(ctx.world);
      let closeError: unknown;
      for (const delivery of deliveries)
        try {
          delivery.close();
        } catch (error) {
          closeError ??= error;
        }
      if (!failed && closeError !== undefined) throw closeError;
    }
  },
};
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze([
  [AWAKENED_WITCH_NIGHT_STAGE, AWAKENED_WITCH_NIGHT_STAGE.execute] as const,
]);
