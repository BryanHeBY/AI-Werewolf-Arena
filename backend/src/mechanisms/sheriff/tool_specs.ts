import { ToolSpec } from "../contracts";

export const SHERIFF_TOOL_SPECS: ToolSpec[] = [
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

