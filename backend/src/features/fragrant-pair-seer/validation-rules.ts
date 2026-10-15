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
import { FRAGRANT_PAIR_VALIDATION_SCOPE } from "../../rulesets/action-validation-assembly";
import { canSubmitFragrantPairChoice, fragrantPairRequestScope } from "./requests";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";

export function createFragrantValidationRules() {
  return ownedToolRules(
    {
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      bind_fragrant_pair: ({ world, actorId, phase, day, scope: fragrantPairScope, toolCall }) =>
        canSubmitFragrantPairChoice(world, actorId, phase, day ?? 0, fragrantPairScope, toolCall)
          ? null
          : { code: RuleError.FragrantPairUnavailable },
    },
    FRAGRANT_PAIR_VALIDATION_SCOPE,
  );
}

export function createPairValidationRules() {
  return ownedToolRules(
    {
      check_pair: ({ world, actorId, phase, day, scope: fragrantPairScope, toolCall }) =>
        canSubmitFragrantPairChoice(world, actorId, phase, day ?? 0, fragrantPairScope, toolCall)
          ? null
          : { code: RuleError.FragrantPairUnavailable },
    },
    FRAGRANT_PAIR_VALIDATION_SCOPE,
  );
}

/** 可信装配持有本族完整准入；scope观察仍在接收器原阶段，原对象不交公开规则扩展。 */
export const FRAGRANT_PAIR_REQUEST_ADMISSION: TrustedRequestAdmission = {
  owner: FRAGRANT_PAIR_VALIDATION_SCOPE,
  capture: fragrantPairRequestScope,
};
