/**
 * Provides the original radiant-eclipse scripted action driver for tests.
 * Inputs are issued requests, explicit choices or captured game handles;
 * outputs are the same callbacks and literal ToolCalls/null decisions.
 * It keeps the original local reads and defaults, without running a model,
 * advancing a phase, changing stock or regenerating expected outcomes.
 */
import { radiantFullPlans } from "../oracles/literal-plans";
import type { RadiantFullPlanName } from "../oracles/literal-plans";
import { PotionType } from "../../../../../src/domain";
import type { ActionRequest } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";

export function radiantManualAction(
  q: ActionRequest,
  planName?: RadiantFullPlanName,
): ToolCall | undefined {
  if (planName) {
    const plan = radiantFullPlans.find((p) => p.name === planName)!,
      night = plan.nights[q.context.day - 1];
    if (!night) throw Error("radiant_full_plan_exhausted");
    switch (q.context.stage) {
      case "eclipse_swallow":
        return { name: "swallow_skill", args: { target_id: night.swallow } };
      case "radiant_shelter":
        return { name: "cast_shelter", args: { target_id: night.shelter } };
      case "dreamer":
        return { name: "dream", args: { target_id: night.dream } };
      case "wolf_vote":
        return { name: "kill_vote", args: { target_id: night.knife, abstain: false } };
      case "witch": {
        const bottle = "potion" in night ? night.potion : undefined;
        return {
          name: "use_potion",
          args: {
            target_id: bottle?.[1] ?? q.actorId,
            potion_type:
              bottle?.[0] === "heal"
                ? PotionType.Heal
                : bottle?.[0] === "poison"
                  ? PotionType.Poison
                  : PotionType.None,
          },
        };
      }
      case "seer":
        return { name: "check_identity", args: { target_id: "seer" in night ? night.seer : 1 } };
      case "sheriff_nomination":
      case "sheriff_withdraw":
        return { name: "run_for_sheriff", args: { run: q.actorId === plan.sheriff } };
      case "sheriff_vote":
      case "sheriff_pk_vote":
        return {
          name: "vote_for_sheriff",
          args: { target_id: plan.sheriff, abstain: plan.sheriff === null },
        };
      case "sheriff_choose_direction":
        return { name: "choose_direction", args: { direction: "clockwise" } };
      case "sheriff_badge_choice":
        return { name: "choose_badge_successor", args: { target_id: 2 } };
      case "voting":
        return {
          name: "vote",
          args: {
            target_id: q.actorId === night.exile ? null : night.exile,
            abstain: night.exile === null || q.actorId === night.exile,
          },
        };
    }
    return undefined;
  }
  const day = q.context.day;
  switch (q.context.stage) {
    case "eclipse_swallow":
      return { name: "swallow_skill", args: { target_id: day === 2 ? 4 : day === 3 ? 2 : 5 } };
    case "radiant_shelter":
      return { name: "cast_shelter", args: { target_id: day === 2 ? 6 : day === 3 ? 5 : 7 } };
    case "dreamer":
      return {
        name: "dream",
        args: { target_id: day === 1 ? 6 : day === 2 ? 8 : day === 3 ? 1 : 7 },
      };
    case "wolf_vote":
      return {
        name: "kill_vote",
        args: { target_id: day === 1 ? 10 : day === 2 ? 8 : day === 3 ? 5 : 7, abstain: false },
      };
    case "witch":
      return {
        name: "use_potion",
        args:
          day === 1
            ? { target_id: 10, potion_type: PotionType.Heal }
            : day === 2
              ? { target_id: 6, potion_type: PotionType.Poison }
              : day === 3
                ? { target_id: 1, potion_type: PotionType.Poison }
                : { target_id: q.actorId, potion_type: PotionType.None },
      };
    case "seer":
      return { name: "check_identity", args: { target_id: 1 } };
    case "voting": {
      const target = day === 1 ? 10 : day === 2 ? 11 : day === 3 ? 12 : 1;
      return {
        name: "vote",
        args: { target_id: q.actorId === target ? null : target, abstain: q.actorId === target },
      };
    }
  }
  return undefined;
}
