/**
 * 负责声明警徽接任、竞选、投票和方向的传输 schema 与参数提示。输入为静态工具规格；
 * 输出为原可写数组。徽目标仍为 integer／null，普通警长票目标保 number／null；
 * 规格不核存活、票权、徽政策或当前许可，也不提交选举结果。
 */
import { withTargetOrAbstain } from "../../engine/actions/argument-variants";
import { ToolSpec } from "../../engine/actions/tool-contracts";

/** 警长机制工具规格列表。 */
export const SHERIFF_TOOL_SPECS: ToolSpec[] = [
  {
    name: "choose_badge_successor",
    parameters: {
      type: "object",
      properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
      required: ["target_id"],
      additionalProperties: false,
    },
    argHint: 'choose_badge_successor args: {"target_id":number|null}',
  },
  {
    name: "run_for_sheriff",
    parameters: {
      type: "object",
      properties: {
        run: {
          type: "boolean",
        },
      },
      required: ["run"],
      additionalProperties: false,
    },
    argHint: 'run_for_sheriff args: {"run":true|false}',
  },
  {
    name: "vote_for_sheriff",
    ...withTargetOrAbstain({
      type: "object",
      properties: {
        target_id: {
          type: ["number", "null"],
        },
        abstain: {
          type: "boolean",
        },
      },
      required: ["target_id", "abstain"],
      additionalProperties: false,
    }),
    argHint: 'vote_for_sheriff args: {"target_id":number|null,"abstain":true|false}',
  },
  {
    name: "choose_direction",
    parameters: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["clockwise", "counter_clockwise"],
        },
      },
      required: ["direction"],
      additionalProperties: false,
    },
    argHint: 'choose_direction args: {"direction":"clockwise"|"counter_clockwise"}',
  },
];
