/** 文件说明：女巫工具规格与阶段提示规则定义。 */
import { PotionType } from "../../../../domain/model";
import { StageDirectiveRule, ToolSpec } from "../../contracts";
import { prop } from "../../shared/schema";

const usePotionSchema = {
  name: "use_potion",
  description: "女巫使用解药或毒药，不能同夜双药，MVP 不可自救",
  parameters: {
    type: "object",
    properties: {
      target_id: { type: "number" },
      potion_type: { type: "string", enum: ["heal", "poison", "none"] },
    },
    required: ["target_id", "potion_type"],
  },
} as const;

/** 女巫工具规格列表。 */
export const WITCH_TOOL_SPECS: ToolSpec[] = [
  {
    name: "use_potion",
    llm: {
      name: "use_potion",
      description: "女巫使用药剂。",
      parameters: {
        type: "object",
        properties: {
          target_id: prop("number", "药剂目标玩家编号。"),
          potion_type: {
            type: "string",
            enum: [PotionType.Heal, PotionType.Poison, PotionType.None],
            description: "药剂类型：heal=解药，poison=毒药，none=本轮不使用药剂。",
          },
        },
        description: "女巫用药参数。",
        required: ["target_id", "potion_type"],
        additionalProperties: false,
      },
    },
    argHint: `use_potion args: {"target_id":number,"potion_type":"${PotionType.Heal}"|"${PotionType.Poison}"|"${PotionType.None}"}`,
    gatewaySchema: usePotionSchema,
  },
];

/** 女巫阶段提示规则。 */
export const WITCH_STAGE_DIRECTIVES: StageDirectiveRule[] = [
  {
    match: (allowedTools) => allowedTools.length === 1 && allowedTools[0] === "use_potion",
    text: `当前是【女巫行动阶段】：必须调用 use_potion；若本夜不用药，调用 use_potion 并设置 potion_type="${PotionType.None}"。`,
  },
];
