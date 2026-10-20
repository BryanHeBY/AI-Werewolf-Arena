/**
 * 负责盗贼／千面人共同原始卡位读取与两份真实请求证明的接线。输入保原 request／参数，
 * 输出原 slot 或原错误；不安装身份、复制牌或把路由身份当权限。两种领域 allowedSlots 政策仍由各 profile 的完整规则复验。
 */
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { readThiefChoice } from "../thief/state-ports";
import { thiefRequestScope } from "../thief/ports";
import { shapeshifterRequestScope } from "../shapeshifter/ports";
import {
  THIEF_VALIDATION_SCOPE,
  SHAPESHIFTER_VALIDATION_SCOPE,
} from "../../rulesets/action-validation-assembly";
import type { TrustedRequestAdmission } from "../../engine/actions/validation-queries";
export const THIEF_REQUEST_ADMISSION: TrustedRequestAdmission = {
  owner: THIEF_VALIDATION_SCOPE,
  capture: thiefRequestScope,
  raw: (_world, _request, tool, rawArgs) => {
    const initialChoice = tool === "choose_thief_card" || tool === "choose_shapeshifter_card";
    const thiefSlot = initialChoice ? readThiefChoice(rawArgs) : undefined;
    if (initialChoice && thiefSlot === undefined)
      return {
        ok: false,
        error: tool === "choose_thief_card" ? RuleError.ThiefChoice : RuleError.ShapeshifterChoice,
      };
    return { ok: true, ...(initialChoice ? { args: { slot: thiefSlot } } : {}) };
  },
};
export const SHAPESHIFTER_REQUEST_ADMISSION: TrustedRequestAdmission = {
  owner: SHAPESHIFTER_VALIDATION_SCOPE,
  capture: shapeshifterRequestScope,
};
