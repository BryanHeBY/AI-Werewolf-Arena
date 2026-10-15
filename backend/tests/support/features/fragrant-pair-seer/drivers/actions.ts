/**
 * Provides the original fragrant-pair-seer scripted action driver for tests.
 * Inputs are issued requests, explicit choices or captured game handles;
 * outputs are the same callbacks and literal ToolCalls/null decisions.
 * It keeps the original local reads and defaults, without running a model,
 * advancing a phase, changing stock or regenerating expected outcomes.
 */
import type { FragrantRuntimePlan } from "../contracts";
import { PotionType } from "../../../../../src/domain/identity";
import type { ActionRequest } from "../../../../../src/domain/actions";
import type { ToolCall } from "../../../../../src/domain/actions";

export function fragrantRuntimeAction(
  r: ActionRequest,
  p: FragrantRuntimePlan = {},
): ToolCall | null {
  if (r.allowedTools.includes("bind_fragrant_pair"))
    return { name: "bind_fragrant_pair", args: { target_ids: p.bind ?? null } };
  if (r.allowedTools.includes("check_pair")) {
    const ids = r.context.pair_check_candidates!;
    return { name: "check_pair", args: { target_ids: ids.includes(2) ? [9, 2] : [9, 10] } };
  }
  if (r.allowedTools.includes("speak_to_wolves"))
    return { name: "speak_to_wolves", args: { text: "ok", end_chat: true } };
  if (r.allowedTools.includes("kill_vote"))
    return { name: "kill_vote", args: { target_id: p.knife ?? null, abstain: p.knife == null } };
  if (r.allowedTools.includes("guard"))
    return { name: "guard", args: { target_id: null, abstain: true } };
  if (r.allowedTools.includes("use_potion"))
    return {
      name: "use_potion",
      args: {
        target_id: p.poison ?? r.actorId,
        potion_type: p.poison == null ? PotionType.None : PotionType.Poison,
      },
    };
  if (r.allowedTools.includes("vote"))
    return { name: "vote", args: { target_id: p.exile ?? null, abstain: p.exile == null } };
  if (r.allowedTools.includes("shoot"))
    return { name: "shoot", args: { target_id: p.shoot ?? null } };
  if (r.allowedTools.includes("run_for_sheriff"))
    return { name: "run_for_sheriff", args: { run: r.actorId === p.sheriff } };
  if (r.allowedTools.includes("vote_for_sheriff"))
    return {
      name: "vote_for_sheriff",
      args: { target_id: p.sheriff ?? null, abstain: p.sheriff == null },
    };
  if (r.allowedTools.includes("choose_direction"))
    return { name: "choose_direction", args: { direction: "clockwise" } };
  if (r.allowedTools.includes("choose_badge_successor"))
    return { name: "choose_badge_successor", args: { target_id: p.badge ?? null } };
  if (r.allowedTools.includes("speak"))
    return { name: "speak", args: { text: `speech:${r.context.stage}:${r.actorId}` } };
  if (r.allowedTools.includes("self_destruct")) return null;
  return null;
}
