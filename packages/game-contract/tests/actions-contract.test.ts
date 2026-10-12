/**
 * Package unit/type contract for the mechanical tool and turn-data extraction.
 * Independent sequence digests are frozen from Git 87542c8: literal tool order
 * and ActionWindow/KnightDuelWindow-expanded stage order. Type counterexamples
 * preserve nullable, readonly and discriminated argument contracts. No runtime
 * provider, request lease, role resolver or gameplay authority is executed here.
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  TOOL_NAMES,
  ACTION_STAGES,
  DEATH_SHOT_STAGES,
  type ToolName,
  type ToolArgMap,
  type ToolCall,
  type TypedToolCall,
  type ToolValidationResult,
  type TurnConstraints,
} from "@ai-werewolf-arena/game-contract/actions";
import {
  PotionType,
  TOOL_NAMES as rootTools,
  ACTION_STAGES as rootStages,
  DEATH_SHOT_STAGES as rootDeathStages,
} from "@ai-werewolf-arena/game-contract";
// @ts-expect-error A callable runtime provider is not serialized tool/turn data.
import type { ActionProvider } from "@ai-werewolf-arena/game-contract";

const digest = (values: readonly string[]) =>
  createHash("sha256").update(JSON.stringify(values)).digest("hex");

test("65 tool IDs and 82 runtime stages retain the exact frozen sequence and public singleton", () => {
  expect(TOOL_NAMES).toHaveLength(65);
  expect(digest(TOOL_NAMES)).toBe(
    "55594da0f2ee11b46ed5004b26bcaca6bca9d213360e8bf2f1bf96b6a12807e2",
  );
  expect(ACTION_STAGES).toHaveLength(82);
  expect(digest(ACTION_STAGES)).toBe(
    "470508b488c62e83ad98065268578354f3bf333f68ae6591b57bfc9cec54c317",
  );
  expect(DEATH_SHOT_STAGES).toEqual(["hunter_shot", "death_shot"]);
  expect(TOOL_NAMES).toBe(rootTools);
  expect(ACTION_STAGES).toBe(rootStages);
  expect(DEATH_SHOT_STAGES).toBe(rootDeathStages);
  // Original readonly types did not freeze their runtime arrays.
  expect(Object.isFrozen(TOOL_NAMES)).toBe(false);
  expect(Object.isFrozen(ACTION_STAGES)).toBe(false);
});

test("tool discriminants retain nullable passes, readonly pairs and nominal potion values", () => {
  const vote: TypedToolCall<"vote"> = { name: "vote", args: { target_id: null, abstain: true } };
  const pair: ToolArgMap["check_pair"] = { target_ids: [1, 2] };
  const potion: ToolCall = {
    name: "use_potion",
    args: { target_id: 1, potion_type: PotionType.None },
  };
  const validation: ToolValidationResult<typeof vote> = { ok: true, sanitizedCall: vote };
  // @ts-expect-error Unknown tools do not enter the closed tool union.
  const unknown: ToolName = "invented_tool";
  // @ts-expect-error A required inspection target cannot become a pass.
  const noTarget: ToolArgMap["check_identity"] = { target_id: null };
  // @ts-expect-error Typed vote calls cannot silently select another tool.
  const wrongTool: TypedToolCall<"vote"> = { name: "shoot", args: { target_id: 1 } };
  // @ts-expect-error Potion args keep their existing enum type.
  const rawPotion: ToolArgMap["use_potion"] = { target_id: 1, potion_type: "none" };
  if (false) {
    // @ts-expect-error The pair tuple remains readonly through the tool contract.
    pair.target_ids[0] = 3;
  }
  void [unknown, noTarget, wrongTool, rawPotion];
  expect(vote).toEqual({ name: "vote", args: { target_id: null, abstain: true } });
  expect(potion).toEqual({
    name: "use_potion",
    args: { target_id: 1, potion_type: PotionType.None },
  });
  expect(validation.sanitizedCall).toBe(vote);
});

test("optional turn constraints retain raw summary and a closed MessageRef without adding policy", () => {
  const empty: TurnConstraints = {};
  const raw: TurnConstraints = { summary: "Custom original {role}" };
  const structured: TurnConstraints = {
    required_any_tools: ["speak"],
    summary_message: { key: "common.player", parameters: { id: 12 } },
  };
  // @ts-expect-error Structured summaries keep the full closed machine key set.
  const unknownKey: TurnConstraints = { summary_message: { key: "invented_message" } };
  // @ts-expect-error Required tools keep the closed tool ID union.
  const unknownTool: TurnConstraints = { required_any_tools: ["invented_tool"] };
  void [unknownKey, unknownTool];
  expect(empty).toEqual({});
  expect(raw.summary).toBe("Custom original {role}");
  expect(structured).toEqual({
    required_any_tools: ["speak"],
    summary_message: { key: "common.player", parameters: { id: 12 } },
  });
});
