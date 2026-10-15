/**
 * 负责女巫工具传输规格及阶段提示贡献。输入为瓶型枚举、target_id schema 和 allowedTools；
 * 输出为原可写工具数组与本地化指令。number 规格／提示不验证当前库存、目标或救毒资格，
 * 不修复参数、提交用药或扩张事件可见性。
 */
import { text } from "@ai-werewolf-arena/game-text";
/** 文件说明：女巫工具规格与阶段提示规则定义。 */
import { PotionType } from "../../../../domain/model";
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
