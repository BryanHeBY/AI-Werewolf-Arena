/**
 * Provides the original radiant-eclipse scripted action driver for tests.
 * Inputs are issued requests, explicit choices or captured game handles;
 * outputs are the same callbacks and literal ToolCalls/null decisions.
 * It keeps the original local reads and defaults, without running a model,
 * advancing a phase, changing stock or regenerating expected outcomes.
 */
import { PotionType } from "../../../../../src/core";
import type { ActionRequest } from "../../../../../src/core";
import type { ToolCall } from "../../../../../src/core";

export interface RadiantChoices {
  swallow?: number | null;
  shelter?: number | null;
  dream?: number;
  knife?: number | null;
  potion?: { target_id: number; potion_type: "heal" | "poison" | "none" };
}

export function radiantProvider(
  requests: ActionRequest[],
  choices: RadiantChoices = {},
  override?: (
    r: ActionRequest,
  ) => ToolCall | null | undefined | Promise<ToolCall | null | undefined>,
) {
  return {
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      requests.push(structuredClone(r));
      const value = await override?.(r);
      if (value !== undefined) return value;
      switch (r.context.stage) {
        case "eclipse_swallow":
          return { name: "swallow_skill", args: { target_id: choices.swallow ?? null } };
        case "radiant_shelter":
          return { name: "cast_shelter", args: { target_id: choices.shelter ?? null } };
        case "dreamer":
          return { name: "dream", args: { target_id: choices.dream ?? 9 } };
        case "wolf_discussion":
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        case "wolf_vote":
          return {
            name: "kill_vote",
            args: { target_id: choices.knife ?? null, abstain: choices.knife == null },
          };
        case "witch":
          return {
            name: "use_potion",
            args: {
              target_id: choices.potion?.target_id ?? r.actorId,
              potion_type:
                choices.potion?.potion_type === "heal"
                  ? PotionType.Heal
                  : choices.potion?.potion_type === "poison"
                    ? PotionType.Poison
                    : PotionType.None,
            },
          };
        case "seer":
          return { name: "check_identity", args: { target_id: 10 } };
        case "sheriff_nomination":
          return { name: "run_for_sheriff", args: { run: false } };
        case "voting":
          return { name: "vote", args: { target_id: null, abstain: true } };
      }
      if (r.allowedTools.includes("self_destruct"))
        return { name: "self_destruct", args: { confirm: false, reason: "Synthetic pass" } };
      if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "Synthetic" } };
      throw new Error(`unexpected_radiant_request:${r.context.stage}`);
    },
  };
}
