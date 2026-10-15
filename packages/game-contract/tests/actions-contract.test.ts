/**
 * 包级单元／类型契约测试验证工具与回合数据的提取边界。
 * 独立预期为 Git 87542c8 冻结的工具顺序摘要及展开 ActionWindow／KnightDuelWindow 后的阶段顺序；
 * 类型负例保留可空目标、只读元组和工具判别参数。运行数组原本可写，不因 readonly 声明而冻结。
 * 这里不执行 provider、请求租约、角色结算或行动授权。
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

test("原65工具及82阶段保持固定前缀，新交付标识仅明确追加", () => {
  expect(TOOL_NAMES).toHaveLength(79);
  expect(digest(TOOL_NAMES.slice(0, 65))).toBe(
    "55594da0f2ee11b46ed5004b26bcaca6bca9d213360e8bf2f1bf96b6a12807e2",
  );
  expect(ACTION_STAGES).toHaveLength(98);
  expect(digest(ACTION_STAGES.slice(0, 82))).toBe(
    "470508b488c62e83ad98065268578354f3bf333f68ae6591b57bfc9cec54c317",
  );
  expect(TOOL_NAMES.slice(65)).toEqual([
    "awakened_brew",
    "brew_discuss",
    "brew_approve",
    "warden_pair",
    "warden_decide",
    "bequeath_claw",
    "curse_exile",
    "silence",
    "gesture",
    "translate_silence",
    "awakened_charm",
    "patrol",
    "awakened_protect",
    "awakened_duel",
  ]);
  expect(ACTION_STAGES.slice(82)).toEqual([
    "awakened_witch",
    "brew_discussion",
    "brew_approval",
    "warden_pair",
    "warden_decide",
    "crow_curse",
    "awakened_claw_bequest",
    "silence_elder",
    "silence_gesture",
    "silence_translation",
    "awakened_charm",
    "awakened_patrol",
    "awakened_protection_night",
    "awakened_protection_day",
    "awakened_duel",
    "awakened_duel_continue",
  ]);
  expect(DEATH_SHOT_STAGES).toEqual(["hunter_shot", "death_shot"]);
  expect(TOOL_NAMES).toBe(rootTools);
  expect(ACTION_STAGES).toBe(rootStages);
  expect(DEATH_SHOT_STAGES).toBe(rootDeathStages);
  // 原 readonly 类型没有冻结运行时数组。
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
