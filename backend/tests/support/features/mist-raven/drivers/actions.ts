/**
 * 提供本模块原测试脚本行动驱动；输入为已发请求、显式选择或捕获的游戏句柄，输出为原回调及字面 ToolCall／null 决策。保留原局部读取和默认值；不运行模型、推进阶段、改变库存或重新生成结果预期。
 */
import type { MistRecordVariant } from "../builders/board";
import { manualPlans } from "../builders/literal-plans";
import type { ActionRequest } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";

export function mistAction(
  q: ActionRequest,
  variant: MistRecordVariant,
  windowRound = 1,
): ToolCall | null {
  const s = q.context.stage,
    d = q.context.day,
    index = d - 1,
    plan = manualPlans[variant];
  if (d > plan.knife.length) throw new Error("mist_fixture_unexpected_day");
  if (
    plan.blast &&
    d === plan.blast.day &&
    s === plan.blast.window &&
    windowRound === (plan.blastRound ?? 1) &&
    (q.actorId === 10 || (plan.parallelBlast && q.actorId === 11))
  )
    return { name: "self_destruct", args: { confirm: true, reason: "Manual blast" } };
  if (s === "alchemist_mist")
    return {
      name: "cast_mist",
      args: { target_ids: d === 1 && plan.circle ? [...plan.circle] : null },
    };
  if (s === "dreamer") return { name: "dream", args: { target_id: plan.dream[index]! } };
  if (s === "wolf_discussion")
    return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
  if (s === "wolf_vote")
    return {
      name: "kill_vote",
      args: { target_id: plan.knife[index]!, abstain: plan.knife[index] === null },
    };
  if (s === "raven_knife") return { name: "raven_knife", args: { target_id: plan.extra[index]! } };
  if (s === "seer")
    return { name: "check_identity", args: { target_id: variant === "blast-last-wolf" ? 10 : 9 } };
  if (s === "sheriff_nomination")
    return { name: "run_for_sheriff", args: { run: !!plan.blast && q.actorId === 10 } };
  if (plan.blast && s === "sheriff_withdraw")
    return { name: "run_for_sheriff", args: { run: true } };
  if (plan.blast && s === "sheriff_choose_direction")
    return { name: "choose_direction", args: { direction: "clockwise" } };
  if (plan.blast && s === "sheriff_badge_choice")
    return {
      name: "choose_badge_successor",
      args: { target_id: plan.doubleBadge && q.actorId === 10 ? 5 : 6 },
    };
  if (s === "alchemist_snake")
    return { name: "use_snake", args: { target_id: plan.snake[index]! } };
  if (s === "day_speech" || s === "last_words" || (plan.blast && s === "sheriff_campaign_speech"))
    return { name: "speak", args: { text: "Words" } };
  if (s === "voting") {
    if (variant === "blast-last-wolf" && d === 2)
      return { name: "vote", args: { target_id: null, abstain: true } };
    const target = plan.exile[index]!;
    return {
      name: "vote",
      args: { target_id: q.actorId === target ? null : target, abstain: q.actorId === target },
    };
  }
  return null;
}
