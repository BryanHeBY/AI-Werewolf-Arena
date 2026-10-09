import { text } from "@ai-werewolf-arena/game-text";
/** 文件说明：女巫工具规格与阶段提示规则定义。 */
import { PotionType } from "../../../../core/domain/model";
import { StageDirectiveRule, ToolSpec } from "../../contracts";

/** 女巫工具规格列表。 */
export const WITCH_TOOL_SPECS: ToolSpec[] = [
  {
    name: "use_potion",
    parameters: {
      type: "object",
      properties: {
        target_id: { type: "number" },
        potion_type: {
          type: "string",
          enum: [PotionType.Heal, PotionType.Poison, PotionType.None],
        },
      },
      required: ["target_id", "potion_type"],
      additionalProperties: false,
    },
    argHint: `use_potion args: {"target_id":number,"potion_type":"${PotionType.Heal}"|"${PotionType.Poison}"|"${PotionType.None}"}`,
  },
];

/** 女巫阶段提示规则。 */
export const WITCH_STAGE_DIRECTIVES: StageDirectiveRule[] = [
  {
    match: (allowedTools) => allowedTools.length === 1 && allowedTools[0] === "use_potion",
    messageKey: "action.witch.directive",
    text: text("zh-CN", "action.witch.directive"),
  },
];
