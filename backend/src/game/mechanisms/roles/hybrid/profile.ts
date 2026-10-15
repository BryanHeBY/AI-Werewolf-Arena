/**
 * 负责 混血儿 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 * 行动规则在原资格／目标读取后的成功尾拒执行退休；初始化、baseline 与玩家知识不按该标记过滤。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { COMPONENT } from "../../../../domain/components/names";
import { isRoleExecutionRetired } from "../../../../domain/role-execution-authority";
import type { VictoryComponent } from "../../../../domain/components/victory";
import { Camp, Role, Phase } from "../../../../domain/model";
import type { NativeRoleContributions } from "../contracts";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";
import { canChooseExemplar, getHybridState, projectHybridState, installHybridState } from "./state-slot";
import { HYBRID_STAGE } from "./night_stage";

export const HYBRID_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Hybrid,
    camp: Camp.Good,
    goodSide: "villager",
    maxCount: 1,
    label: roleName("hybrid"),
    skillBrief: text("zh-CN", "role.hybrid.brief"),
    supportedBoardRoles: [
      Role.Hybrid,
      Role.Wolf,
      Role.WolfKing,
      Role.HiddenWolf,
      Role.Seer,
      Role.Witch,
      Role.Guard,
      Role.Hunter,
      Role.Idiot,
      Role.Villager,
    ],
  },
  runtime: {
    initialVictoryAffiliations: [],
    init: installHybridState,
    configuration: {
      schema: z.strictObject({}),
      defaults: {},
      apply: (config) => config,
      serialize: () => ({}),
    },
    nightStages: [HYBRID_STAGE],
    toolSpecs: [
      {
        name: "choose_exemplar",
        parameters: {
          type: "object",
          properties: { target_id: { type: "integer" } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'choose_exemplar args: {"target_id":number}',
        userPromptHintKey: "action.choose_exemplar.hint",
      },
    ],
    validationRules: {
      choose_exemplar: ({ world, actorId, role, day, phase, toolCall }) => {
        const state = getHybridState(role),
          victory = world.getComponent(actorId, COMPONENT.Victory);
        if (
          role.role !== Role.Hybrid ||
          world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Good ||
          !state ||
          day === undefined ||
          !canChooseExemplar(state, day) ||
          !victory ||
          victory.affiliations.length !== 0
        )
          return { code: RuleError.HybridUnavailable };
        if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
        if (toolCall.name !== "choose_exemplar") return { code: RuleError.ToolMismatch };
        if (toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id))
          return { code: RuleError.HybridTarget };
        return isRoleExecutionRetired(role) ? { code: RuleError.HybridUnavailable } : null;
      },
    },
    llmRepair: {
      coerce: {
        choose_exemplar: (args) => {
          const target = numberOrNull(args.target_id);
          return target === null ? null : { target_id: target };
        },
      },
    },
  },
  presentation: nativeRolePresentation("hybrid"),
};
