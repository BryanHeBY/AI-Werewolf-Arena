/**
 * 负责 骑士 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Role, Camp, Phase, KnightDuelWindow } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getKnightState, setKnightState } from "./state";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";

export const KNIGHT_ROLE_PROFILE: RoleProfile = {
  role: Role.Knight,
  camp: Camp.Good,
  goodSide: "god",
  label: roleName("knight"),
  skillBrief: text("zh-CN", "role.knight.brief"),
  init: (role) => {
    setKnightState(role, { canDuel: true });
  },
  ...nativeRolePresentation("knight"),
  configuration: {
    schema: z.strictObject({
      enabledWindows: z
        .array(z.enum(KnightDuelWindow))
        .refine((windows) => new Set(windows).size === windows.length)
        .default([KnightDuelWindow.AfterSpeeches]),
    }),
    defaults: { enabledWindows: [KnightDuelWindow.AfterSpeeches] },
    apply: (config, value) => ({
      ...config,
      knight: value as { enabledWindows: KnightDuelWindow[] },
    }),
    serialize: (config) => ({
      enabledWindows: [...(config.knight?.enabledWindows ?? [KnightDuelWindow.AfterSpeeches])],
    }),
  },
  toolSpecs: [
    {
      name: "duel",
      parameters: {
        type: "object",
        properties: { target_id: { type: "number" }, confirm: { type: "boolean" } },
        required: ["target_id", "confirm"],
        additionalProperties: false,
      },
      argHint: 'duel args: {"target_id":number,"confirm":true}',
      userPromptHintKey: "action.knight.hint",
    },
  ],
  validationRules: {
    duel: ({ world, actorId, role, toolCall, phase, duelWindow, allowKnightDuel }) => {
      if (role.role !== Role.Knight || getKnightState(role)?.canDuel !== true)
        return { code: RuleError.KnightDuelUnavailable };
      if (
        phase !== Phase.Day ||
        !allowKnightDuel ||
        duelWindow === undefined ||
        !Object.values(KnightDuelWindow).includes(duelWindow)
      )
        return { code: RuleError.KnightDuelWindow };
      if (toolCall.name !== "duel" || toolCall.args.confirm !== true)
        return { code: RuleError.KnightDuelConfirm };
      if (toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id))
        return { code: RuleError.KnightDuelTarget };
      return null;
    },
  },
  stageDirectives: [
    {
      match: (tools) => tools.length === 1 && tools[0] === "duel",
      messageKey: "action.knight.directive",
      text: text("zh-CN", "action.knight.directive"),
    },
  ],
  llmRepair: {
    coerce: {
      duel: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target, confirm: Boolean(args.confirm) };
      },
    },
  },
  baselineAction: () => null,
};
