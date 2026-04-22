/** 文件说明：警长机制工具规格定义。 */
import { ToolSpec } from "../contracts";

/** 警长机制工具规格列表。 */
export const SHERIFF_TOOL_SPECS: ToolSpec[] = [
  {
    name: "run_for_sheriff",
    llm: {
      name: "run_for_sheriff",
      description: "声明是否上警参与警长竞选。",
      parameters: {
        type: "object",
        properties: {
          run: {
            type: "boolean",
            description: "true=上警，false=不参与上警。",
          },
        },
        description: "上警报名参数。",
        required: ["run"],
        additionalProperties: false,
      },
    },
    argHint: 'run_for_sheriff args: {"run":true|false}',
    userPromptHint: "如果选择退水，请将 run 设置为 false；如果选择继续上警，请将 run 设置为 true。",
  },
  {
    name: "vote_for_sheriff",
    llm: {
      name: "vote_for_sheriff",
      description: "在警长候选人中投票，可选择弃票。",
      parameters: {
        type: "object",
        properties: {
          target_id: {
            type: ["number", "null"],
            description: "投票目标玩家编号；弃票时为 null。",
          },
          abstain: {
            type: "boolean",
            description: "是否弃票。",
          },
        },
        description: "警长投票参数。",
        required: ["target_id", "abstain"],
        additionalProperties: false,
      },
    },
    argHint: 'vote_for_sheriff args: {"target_id":number|null,"abstain":true|false}',
  },
  {
    name: "choose_direction",
    llm: {
      name: "choose_direction",
      description: "警长选择发言方向。",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["clockwise", "counter_clockwise"],
            description: "发言方向：clockwise=顺时针，counter_clockwise=逆时针。",
          },
        },
        description: "警长定序参数。",
        required: ["direction"],
        additionalProperties: false,
      },
    },
    argHint: 'choose_direction args: {"direction":"clockwise"|"counter_clockwise"}',
  },
];
