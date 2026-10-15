/**
 * Provides the original animal-dream scripted action driver for tests.
 * Inputs are issued requests, explicit choices or captured game handles;
 * outputs are the same callbacks and literal ToolCalls/null decisions.
 * It keeps the original local reads and defaults, without running a model,
 * advancing a phase, changing stock or regenerating expected outcomes.
 */
import type { AnimalPlan } from "../contracts";
import { ActionWindow } from "../../../../../src/domain";
import type { ActionRequest } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";

export function animalAction(r: ActionRequest, name: AnimalPlan, first = false): ToolCall | null {
  const d = r.context.day,
    has = (s: ToolCall["name"]) => r.allowedTools.includes(s);
  if (has("speak_to_wolves"))
    return { name: "speak_to_wolves", args: { text: "End discussion", end_chat: true } };
  if (has("fox_distract"))
    return { name: "fox_distract", args: { target_id: name === "fox_beauty" ? 1 : null } };
  if (has("charm"))
    return {
      name: "charm",
      args: {
        target_id:
          name === "fox_beauty"
            ? d === 4
              ? 7
              : 5
            : name === "last_chain"
              ? [7, 8, 6, 12][d - 1]!
              : name === "puffer_knife"
                ? 5
                : null,
      },
    };
  if (has("kill_vote")) {
    const target =
      name === "fox_beauty"
        ? d === 3
          ? 6
          : d === 4
            ? 8
            : null
        : name === "cat_badge"
          ? [9, 6, 7, 8][d - 1]!
          : name === "puffer_knife"
            ? [12, 10, 9, 8][d - 1]!
            : name === "pk"
              ? [null, 5, 6, 9, 10][d - 1]!
              : name === "last_chain"
                ? [9, 10, 11, null][d - 1]!
                : null;
    return { name: "kill_vote", args: { target_id: target, abstain: target === null } };
  }
  if (has("run_for_sheriff"))
    return {
      name: "run_for_sheriff",
      args: { run: r.actorId === (name === "cat_badge" ? 9 : name === "puffer_knife" ? 12 : -1) },
    };
  if (has("vote_for_sheriff"))
    return {
      name: "vote_for_sheriff",
      args: { target_id: name === "cat_badge" ? 9 : 12, abstain: false },
    };
  if (has("choose_direction"))
    return { name: "choose_direction", args: { direction: "clockwise" } };
  if (has("choose_badge_successor"))
    return { name: "choose_badge_successor", args: { target_id: 5 } };
  if (has("speak"))
    return { name: "speak", args: { text: `Literal ${r.context.stage} seat ${r.actorId}` } };
  if (has("self_destruct"))
    return name === "cat_badge" &&
      d === 1 &&
      r.actorId === 2 &&
      r.actionWindow === ActionWindow.OnPreVote
      ? { name: "self_destruct", args: { confirm: true, reason: "Literal skipped vote" } }
      : null;
  if (has("puffer_retaliate")) return { name: "puffer_retaliate", args: { activate: true } };
  if (has("vote")) {
    let target: number | null =
      name === "fox_beauty" || name === "last_chain"
        ? d === 4
          ? 1
          : d + 1
        : name === "cat_badge"
          ? d === 4
            ? 1
            : d + 1
          : name === "puffer_knife"
            ? d
            : name === "full_retaliation"
              ? 12
              : d === 2
                ? 4
                : d === 3
                  ? 1
                  : d === 4
                    ? 2
                    : 3;
    if (name === "pk" && d === 1)
      target =
        r.context.round === 2
          ? null
          : [2, 3].includes(r.actorId)
            ? 12
            : [4, 5].includes(r.actorId)
              ? 6
              : null;
    if (name === "last_chain" && d === 4 && r.actorId === 1) target = 12;
    return { name: "vote", args: { target_id: target, abstain: target === null } };
  }
  throw Error("animal_unplanned_tool:" + r.context.stage);
}
