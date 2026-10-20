/**
 * 负责狼人聊天、刀票、自爆的工具规格及阶段提示。输入为静态 schema、机器工具名与 allowedTools；
 * 输出为原可写规格和本地化指令列表。提示匹配保 includes／单工具条件，schema 不判定狼队资格、
 * 当前窗口或目标，数组可写不授予库存，也不执行任何动作。
 */
import { withTargetOrAbstain, withArgumentVariants } from "../../engine/actions/argument-variants";
import { text } from "@ai-werewolf-arena/game-text";
/** 文件说明：狼人工具规格与阶段提示规则定义。 */
import { StageDirectiveRule, ToolSpec } from "../../engine/actions/tool-contracts";

/** 狼人工具规格列表。 */
export const WOLF_TOOL_SPECS: ToolSpec[] = [
  {
    name: "speak_to_wolves",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
        end_chat: { type: "boolean" },
      },
      required: ["text", "end_chat"],
      additionalProperties: false,
    },
    argHint: 'speak_to_wolves args: {"text":"...","end_chat":true|false}',
    userPromptHintKey: "action.speak_to_wolves.hint",
  },
  {
    name: "kill_vote",
    ...withTargetOrAbstain({
      type: "object",
      properties: {
        target_id: { type: ["number", "null"] },
        abstain: { type: "boolean" },
      },
      required: ["target_id", "abstain"],
      additionalProperties: false,
    }),
    argHint: 'kill_vote args: {"target_id":number|null,"abstain":true|false}',
  },
  {
    name: "self_destruct",
    confirmation: "self_destruct",
    ...withArgumentVariants(
      {
        type: "object",
        properties: {
          reason: { type: "string" },
          confirm: { type: "boolean" },
        },
        required: ["reason", "confirm"],
        additionalProperties: false,
      },
      [{ properties: { confirm: { type: "boolean", const: true } } }],
    ),
    argHint: 'self_destruct args: {"reason":"...","confirm":true}',
  },
];

/** 狼人阶段提示规则。 */
export const WOLF_STAGE_DIRECTIVES: StageDirectiveRule[] = [
  {
    match: (allowedTools) => allowedTools.includes("speak_to_wolves"),
    messageKey: "action.wolf_discussion.directive",
    text: text("zh-CN", "action.wolf_discussion.directive"),
  },
  {
    match: (allowedTools) => allowedTools.length === 1 && allowedTools[0] === "kill_vote",
    messageKey: "action.wolf_vote.directive",
    text: text("zh-CN", "action.wolf_vote.directive"),
  },
  {
    match: (allowedTools) => allowedTools.length === 1 && allowedTools[0] === "self_destruct",
    messageKey: "action.self_destruct.directive",
    text: text("zh-CN", "action.self_destruct.directive"),
  },
];
