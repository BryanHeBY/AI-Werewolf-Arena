/**
 * 负责匿名墙原始文本准入、作者／窗口证明与完整工具验证。输入为原 World 内可信绑定与候选，
 * 输出原错误或通过；处理完成不代表纸条 accepted 或已付款，库存／事实写权仍归 window/authority。
 */
import { readWallTool } from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import { RuleError, Phase } from "@ai-werewolf-arena/game-contract";
import { authorizedWallAuthor, wallRequestScope } from "./authority";
import { WALL_VALIDATION_SCOPE } from "../../rulesets/action-validation-assembly";
import {
  ownedToolRules,
  type TrustedRequestAdmission,
} from "../../engine/actions/validation-queries";
export const WALL_VALIDATION_RULES = ownedToolRules(
  {
    write_note: ({
      world,
      actorId,
      day,
      phase,
      toolCall,
      scope: wallScope,
      wallId,
      itemInstanceId,
    }) => {
      if (
        day !== 1 ||
        phase !== Phase.Voting ||
        !authorizedWallAuthor(world, actorId, wallId, itemInstanceId, wallScope)
      )
        return { code: RuleError.WallNoteUnavailable };
      return readWallTool(toolCall) ? null : { code: RuleError.WallNoteText };
    },
  },
  WALL_VALIDATION_SCOPE,
);
export const WALL_REQUEST_ADMISSION: TrustedRequestAdmission = {
  owner: WALL_VALIDATION_SCOPE,
  capture: wallRequestScope,
  raw: (_world, _request, tool, rawArgs) => {
    const call = tool === "write_note" ? readWallTool({ name: tool, args: rawArgs }) : null;
    if (tool === "write_note" && !call) return { ok: false, error: RuleError.WallNoteText };
    return { ok: true, ...(call ? { args: call.args } : {}) };
  },
};
