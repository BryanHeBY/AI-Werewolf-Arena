/**
 * 负责预言家资料、配置与运行贡献的声明装配，完整查验准入由具名规则组合提供。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { SEER_VALIDATION_RULES } from "../../../../rulesets/seer-tool-admission";
import { z } from "zod";
import {
  SEER_TARGET_POLICIES,
  SEER_ACTION_POLICIES,
  DEFAULT_SEER_ACTION_POLICY,
} from "../../../../domain/board";
import { seerTargetAllowed } from "./ports";
import { roleName, text, term } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
/** 文件说明：预言家角色 profile。 */
import { Camp, Role } from "../../../../domain/model";
import { NativeRoleContributions } from "../contracts";
import { getSeerState, setSeerState } from "./ports";
import { numberOrNull } from "../../llm/helpers";
import { SEER_NIGHT_STAGES } from "./night_stages";
import { SEER_TOOL_SPECS } from "./tool_specs";
import { activeNightAbility } from "../abilities";
import { luckyTargetAllowed } from "../night_action_history";

const parameters = z.strictObject({
  targetPolicy: z.enum(SEER_TARGET_POLICIES).default("awa_alive_v1"),
  actionPolicy: z.enum(SEER_ACTION_POLICIES).default(DEFAULT_SEER_ACTION_POLICY),
});
/** 预言家角色配置。 */
export const SEER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Seer,
    camp: Camp.Good,
    label: roleName("seer"),
    skillBrief: text("zh-CN", "role.seer.brief"),
    goodSide: "god",
  },
  runtime: {
    configuration: {
      schema: parameters,
      defaults: { targetPolicy: "awa_alive_v1", actionPolicy: DEFAULT_SEER_ACTION_POLICY },
      apply: (config, value) => ({ ...config, seer: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.seer ?? {}),
    },
    init: (roleComp, ctx) => {
      setSeerState(roleComp, {
        lastTarget: null,
        lastIsWerewolf: null,
        lastResult: null,
        history: [],
        ...(ctx.boardConfig?.seer?.targetPolicy === "awa_fresh_others_v1"
          ? { targetPolicy: ctx.boardConfig.seer.targetPolicy }
          : {}),
        ...(ctx.boardConfig?.seer?.actionPolicy === "awa_optional_v1"
          ? { actionPolicy: ctx.boardConfig.seer.actionPolicy }
          : {}),
      });
    },
    toolSpecs: SEER_TOOL_SPECS,
    validationRules: SEER_VALIDATION_RULES,
    nightStages: SEER_NIGHT_STAGES,
    llmRepair: {
      coerce: {
        check_identity: (args) => {
          const target = numberOrNull(args.target_id);
          return target === null ? null : { target_id: target };
        },
      },
    },
    baselineAction: (roleComp, request, pickAliveNotSelf, _byCamp, _locale, world) => {
      if (!request.allowedTools.includes("check_identity")) {
        return null;
      }
      const ability = activeNightAbility(
        roleComp,
        "seer_check",
        request.context.day,
        request.context.ability_id,
      );
      const target =
        world && ability
          ? (world
              .getAliveEntityIds()
              .find(
                (id) =>
                  id !== request.actorId &&
                  seerTargetAllowed(ability.state, request.actorId, id) &&
                  luckyTargetAllowed(
                    world,
                    request.actorId,
                    ability,
                    request.context.day,
                    "check",
                    id,
                  ),
              ) ?? null)
          : pickAliveNotSelf();
      return target !== null ? { name: "check_identity", args: { target_id: target } } : null;
    },
  },
  presentation: nativeRolePresentation("seer"),
};
