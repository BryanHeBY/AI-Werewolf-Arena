/**
 * 负责 女巫 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：女巫角色 profile。 */
import { Camp, PotionType, Role, WitchSelfHealRule } from "../../domain/model";
import { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { getWitchState, setWitchState } from "./ports";
import { WITCH_LLM_REPAIR_PACK } from "./llm-repair";
import { WITCH_NIGHT_STAGES } from "./night-stages";
import { WITCH_TOOL_SPECS, WITCH_STAGE_DIRECTIVES } from "./tool-specs";
import { WITCH_VALIDATION_RULES } from "../../rulesets/potion-tool-admission";
import { z } from "zod";
import { WITCH_KNIFE_VISIBILITY_POLICIES, WITCH_POTION_POLICIES } from "../../domain/board";

const witchParameters = z.strictObject({
  selfHeal: z.enum(WitchSelfHealRule).default(WitchSelfHealRule.Disabled),
  knifeVisibility: z.enum(WITCH_KNIFE_VISIBILITY_POLICIES).default("awa_with_heal_v1"),
  potionPolicy: z.enum(WITCH_POTION_POLICIES).default("awa_one_native_v1"),
});

/** 女巫角色配置。 */
export const WITCH_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Witch,
    camp: Camp.Good,
    label: roleName("witch"),
    skillBrief: text("zh-CN", "role.witch.brief"),
    goodSide: "god",
  },
  runtime: {
    configuration: {
      schema: witchParameters,
      defaults: {
        selfHeal: WitchSelfHealRule.Disabled,
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
      },
      apply: (config, value) => {
        const parameters = witchParameters.parse(value);
        return {
          ...config,
          witch: {
            canSelfHeal: parameters.selfHeal,
            knifeVisibility: parameters.knifeVisibility,
            potionPolicy: parameters.potionPolicy,
          },
        };
      },
      serialize: (config) =>
        witchParameters.parse({
          selfHeal: config.witch?.canSelfHeal ?? WitchSelfHealRule.Disabled,
          knifeVisibility: config.witch?.knifeVisibility,
          potionPolicy: config.witch?.potionPolicy,
        }),
    },
    init: (roleComp, ctx) => {
      const selfHealRule = ctx.boardConfig?.witch?.canSelfHeal ?? WitchSelfHealRule.Disabled;
      setWitchState(roleComp, {
        heal: 1,
        poison: 1,
        selfHealRule,
        canSelfHeal:
          selfHealRule === WitchSelfHealRule.Always ||
          selfHealRule === WitchSelfHealRule.FirstNightOnly,
        ...(ctx.boardConfig?.witch?.knifeVisibility &&
        ctx.boardConfig.witch.knifeVisibility !== "awa_with_heal_v1"
          ? { knifeVisibility: ctx.boardConfig.witch.knifeVisibility }
          : {}),
        ...(ctx.boardConfig?.witch?.potionPolicy === "awa_both_native_experimental_v1"
          ? { potionPolicy: ctx.boardConfig.witch.potionPolicy }
          : {}),
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      });
    },
    toolSpecs: WITCH_TOOL_SPECS,
    stageDirectives: WITCH_STAGE_DIRECTIVES,
    validationRules: WITCH_VALIDATION_RULES,
    nightStages: WITCH_NIGHT_STAGES,
    llmRepair: WITCH_LLM_REPAIR_PACK,
    baselineAction: (roleComp, request) => {
      if (!request.allowedTools.includes("use_potion")) {
        return null;
      }
      return {
        name: "use_potion",
        args: {
          target_id: request.actorId,
          potion_type: PotionType.None,
        },
      };
    },
  },
  presentation: nativeRolePresentation("witch"),
};
