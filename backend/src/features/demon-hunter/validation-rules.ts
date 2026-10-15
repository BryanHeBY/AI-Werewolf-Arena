/**
 * 负责猎魔挑战工具的资格校验贡献。输入为当前角色／库存与可信工具上下文，输出原资格拒绝或通过。
 * 规则委托 canSubmitDemonHunt 核具体资格，预检不写角色状态或付款，挑战资源仍由猎魔所有者持有。
 */
import { demonHunterRequestScope, demonHunterActorId } from "./authority";
import { readDemonHuntTool } from "./state-slot";
import {
  demonWitchRequestCurrent,
  demonWitchRequestTargetCurrent,
  readDemonNativeNightTool,
  readDemonPotionTool,
} from "./native-potion-requests";
import type { TrustedRequestAdmission } from "../../engine/actions/validation-queries";

import { DEMON_HUNTER_VALIDATION_SCOPE } from "../../rulesets/action-validation-assembly";

import { ownedToolRule } from "../../engine/actions/validation-queries";

import { RuleError } from "@ai-werewolf-arena/game-contract";
import { canSubmitDemonHunt } from "./authority";
/** profile 明确注册此规则，角色在当前板子是否可运行仍由实际装配负责。 */
export const DEMON_HUNTER_TOOL_RULE = ownedToolRule(
  ({ world, actorId, phase, day, scope: demonHunterScope, toolCall }) =>
    canSubmitDemonHunt(world, actorId, phase, day ?? 0, demonHunterScope, toolCall)
      ? null
      : { code: RuleError.ToolMismatch },
  DEMON_HUNTER_VALIDATION_SCOPE,
);

/** 原生三类预检和hunt仍分别用同一权威；不因通用路由合并来源／目标当前性。 */
export const DEMON_REQUEST_ADMISSION: TrustedRequestAdmission = {
  owner: DEMON_HUNTER_VALIDATION_SCOPE,
  capture: demonHunterRequestScope,
  raw: (world, request, tool, rawArgs) => {
    const demonCall =
      tool === "demon_hunt" ? readDemonHuntTool({ name: tool, args: rawArgs }) : null;
    if (
      tool === "demon_hunt" &&
      (!demonCall ||
        !canSubmitDemonHunt(
          world,
          request.actorId,
          request.phase,
          request.context.day,
          demonHunterRequestScope(world, request),
          demonCall,
        ))
    )
      return { ok: false, error: RuleError.ToolMismatch };
    const demonNative =
      (tool === "check_identity" || tool === "guard") && demonHunterActorId(world) !== null;
    const nativeCall = demonNative ? readDemonNativeNightTool({ name: tool, args: rawArgs }) : null;
    if (
      demonNative &&
      (!nativeCall ||
        !demonWitchRequestCurrent(world, request) ||
        (nativeCall.args.target_id !== null &&
          !demonWitchRequestTargetCurrent(world, request, nativeCall.args.target_id)))
    )
      return { ok: false, error: RuleError.ToolMismatch };
    const demonWitch = tool === "use_potion" && demonHunterActorId(world) !== null;
    const potionCall = demonWitch ? readDemonPotionTool({ name: tool, args: rawArgs }) : null;
    if (
      demonWitch &&
      (!potionCall || !demonWitchRequestTargetCurrent(world, request, potionCall.args.target_id))
    )
      return { ok: false, error: RuleError.ToolMismatch };
    return {
      ok: true,
      ...(potionCall ? { args: potionCall.args } : demonCall ? { args: demonCall.args } : {}),
    };
  },
};
