/**
 * 负责 熊 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数与角色组件；输出为角色资料、配置解析、初始化和展示标识四项贡献，保留原引用与顺序。
 * 展示只登记 bear 标识，实际玩家知识投影归共同观察所有者；本模块不读取动物板知识、授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { BEAR_SIGNAL_POLICIES } from "@ai-werewolf-arena/game-contract";
import { Camp, Role } from "../../domain/model";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { initializeBearState } from "./state";
const parameters = z.strictObject({ signalPolicy: z.enum(BEAR_SIGNAL_POLICIES).optional() });

export const BEAR_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Bear,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    label: roleName("bear"),
    skillBrief: text("zh-CN", "role.bear.brief"),
  },
  runtime: {
    init: initializeBearState,
    configuration: {
      schema: parameters,
      defaults: {},
      apply: (config, value) => {
        const p = parameters.parse(value);
        return p.signalPolicy ? { ...config, bear: { signalPolicy: p.signalPolicy } } : config;
      },
      serialize: (config) => parameters.parse(config.bear ?? {}),
    },
  },
  presentation: nativeRolePresentation("bear"),
};
