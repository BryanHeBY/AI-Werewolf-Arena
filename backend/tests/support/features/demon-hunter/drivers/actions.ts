/**
 * Provides the original demon-hunter scripted action driver for tests.
 * Inputs are issued requests, explicit choices or captured game handles;
 * outputs are the same callbacks and literal ToolCalls/null decisions.
 * It keeps the original local reads and defaults, without running a model,
 * advancing a phase, changing stock or regenerating expected outcomes.
 */
import type { DemonNightChoices } from "../contracts";
import "../../../../../src/app/bootstrap";
import { PotionType } from "../../../../../src/core";
import type { ActionRequest } from "../../../../../src/core";
import type { ToolCall } from "../../../../../src/core";
import type { ToolName } from "../../../../../src/core";

export function demonNightChoice(
  request: ActionRequest,
  witchId: number,
  choices: DemonNightChoices = {},
): ToolCall | null {
  const tools = request.allowedTools;
  if (tools.includes("guard"))
    return {
      name: "guard",
      args: { target_id: choices.guard ?? null, abstain: choices.guard == null },
    };
  if (tools.includes("speak_to_wolves"))
    return { name: "speak_to_wolves", args: { text: "", end_chat: true } };
  if (tools.includes("kill_vote"))
    return {
      name: "kill_vote",
      args: { target_id: choices.knife ?? null, abstain: choices.knife == null },
    };
  if (tools.includes("use_potion"))
    return {
      name: "use_potion",
      args: {
        target_id: choices.potion?.target ?? witchId,
        potion_type: choices.potion?.type ?? PotionType.None,
      },
    };
  if (tools.includes("check_identity")) return { name: "check_identity", args: { target_id: 1 } };
  if ((tools as readonly string[]).includes("demon_hunt"))
    return {
      name: "demon_hunt" as ToolName,
      args: { target_id: choices.hunt ?? null, abstain: choices.hunt == null },
    } as ToolCall;
  if (tools.includes("shoot")) return { name: "shoot", args: { target_id: choices.shot ?? null } };
  if (tools.includes("speak")) return { name: "speak", args: { text: "" } };
  if (tools.includes("run_for_sheriff")) return { name: "run_for_sheriff", args: { run: false } };
  if (tools.includes("vote")) return { name: "vote", args: { target_id: null, abstain: true } };
  return null;
}
