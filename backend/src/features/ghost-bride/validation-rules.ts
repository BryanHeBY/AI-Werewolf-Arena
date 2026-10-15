/**
 * 负责本族完整工具验证、原请求证明关联与原始参数准入。输入为可信宿主、原候选／scope，输出原拒绝或通过。
 * 规则表在 profile 原字段位置才创建，spread／回调捕获时点不提前；模块装配不保存 World、许可或第二份资源。
 * 公共扩展只获窄查询，原 opaque 证明仍须本族权威复验；预检不付款，getter／错误前缀保原顺序。
 */
import { RuleError } from "@ai-werewolf-arena/game-contract";
import {
  ownedToolRules,
  type TrustedRequestAdmission,
} from "../../engine/actions/validation-queries";
import { GHOST_BRIDE_VALIDATION_SCOPE } from "../../rulesets/action-validation-assembly";
import { canSubmitWeddingTool, weddingSetup, ghostBrideRequestScope } from "./authority";
import { readWeddingTool } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import type { OwnedToolRule as ToolRule } from "../../engine/actions/validation-queries";
const validate: ToolRule = ({ world, actorId, phase, day, scope: ghostBrideScope, toolCall }) =>
  canSubmitWeddingTool(world, actorId, phase, day ?? 0, ghostBrideScope, toolCall)
    ? null
    : { code: RuleError.GhostBrideUnavailable };

export function createGhostBrideValidationRules() {
  return ownedToolRules(
    {
      choose_bridegroom: validate,
      choose_wedding_witness: validate,
      speak_to_partner: validate,
      wedding_kill_vote: validate,
    },
    GHOST_BRIDE_VALIDATION_SCOPE,
  );
}

/** 可信装配持有本族完整准入；scope观察仍在接收器原阶段，原对象不交公开规则扩展。 */
export const GHOST_BRIDE_REQUEST_ADMISSION: TrustedRequestAdmission = {
  owner: GHOST_BRIDE_VALIDATION_SCOPE,
  capture: ghostBrideRequestScope,
  raw: (world, _request, tool, rawArgs) => {
    const weddingTool =
      [
        "choose_bridegroom",
        "choose_wedding_witness",
        "speak_to_partner",
        "wedding_kill_vote",
      ].includes(tool) ||
      (tool === "kill_vote" && weddingSetup(world) !== null);
    const call = weddingTool ? readWeddingTool({ name: tool, args: rawArgs }) : null;
    if (weddingTool && !call) return { ok: false, error: RuleError.GhostBrideChoice };
    return { ok: true, ...(call ? { args: call.args } : {}) };
  },
};
