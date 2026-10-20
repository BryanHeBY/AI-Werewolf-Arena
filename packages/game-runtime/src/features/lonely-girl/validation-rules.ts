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
import { LONELY_GIRL_VALIDATION_SCOPE } from "../../rulesets/action-validation-assembly";
import { authorizedLonelyGirl, lonelyGirlRequestScope } from "./lifecycle";
import { readLonelyGirlTool } from "./state-slot";

export function createLonelyGirlValidationRules() {
  return ownedToolRules(
    {
      choose_admired_player: ({ world, actorId, day, phase, toolCall, scope: lonelyGirlScope }) =>
        !authorizedLonelyGirl(world, actorId, day, phase, lonelyGirlScope)
          ? { code: RuleError.LonelyGirlUnavailable }
          : readLonelyGirlTool(toolCall) &&
              toolCall.name === "choose_admired_player" &&
              toolCall.args.target_id !== actorId &&
              world.getAliveEntityIds().includes(toolCall.args.target_id)
            ? null
            : { code: RuleError.LonelyGirlChoice },
    },
    LONELY_GIRL_VALIDATION_SCOPE,
  );
}

/** 可信装配持有本族完整准入；scope观察仍在接收器原阶段，原对象不交公开规则扩展。 */
export const LONELY_GIRL_REQUEST_ADMISSION: TrustedRequestAdmission = {
  owner: LONELY_GIRL_VALIDATION_SCOPE,
  capture: lonelyGirlRequestScope,
  raw: (_world, _request, tool, rawArgs) =>
    tool === "choose_admired_player" && !readLonelyGirlTool({ name: tool, args: rawArgs })
      ? { ok: false, error: RuleError.LonelyGirlChoice }
      : { ok: true },
};
