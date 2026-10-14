/**
 * 负责 猎魔人 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, Camp, WinCondition } from "../../../../core/domain";
import type { NativeRoleContributions } from "../contracts";
import { DEMON_HUNTER_POLICY, installDemonHunterStateSlot } from "./state-slot";
import { projectDemonHunter } from "./authority";
import { DEMON_HUNTER_TOOL_RULE } from "./validation_rules";
import { DEMON_HUNTER_NIGHT_STAGE } from "./night_stages";
const parameters = z.strictObject({
  policy: z.literal(DEMON_HUNTER_POLICY).default(DEMON_HUNTER_POLICY),
});
export const DEMON_HUNTER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.DemonHunter,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterCity, WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.NightNoble,
      Role.AwakenedIdiot,
      Role.RedMoonApostle,
      Role.Idiot,
      Role.DemonHunter,
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Guard,
    ],
    label: roleName("demon_hunter"),
    skillBrief: text("zh-CN", "role.demon_hunter.brief"),
  },
  runtime: {
    canSelfDestruct: false,
    init: (role) => {
      installDemonHunterStateSlot(role);
    },
    configuration: {
      schema: parameters,
      defaults: { policy: DEMON_HUNTER_POLICY },
      apply: (config, value) => ({ ...config, demonHunter: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.demonHunter ?? {}),
    },
    toolSpecs: [
      {
        name: "demon_hunt",
        parameters: {
          type: "object",
          properties: {
            target_id: { type: ["integer", "null"], minimum: 1 },
            abstain: { type: "boolean" },
          },
          required: ["target_id", "abstain"],
          additionalProperties: false,
        },
        argHint: 'demon_hunt args: {"target_id":number|null,"abstain":boolean}',
        userPromptHintKey: "action.demon_hunt.hint",
      },
    ],
    validationRules: { demon_hunt: DEMON_HUNTER_TOOL_RULE },
    nightStages: [DEMON_HUNTER_NIGHT_STAGE],
    baselineAction: (_role, request, pickAliveNotSelf) => {
      if (!request.allowedTools.includes("demon_hunt") || request.context.day < 2) return null;
      const target = pickAliveNotSelf();
      return { name: "demon_hunt", args: { target_id: target, abstain: target === null } };
    },
  },
  presentation: nativeRolePresentation("demon_hunter"),
};
