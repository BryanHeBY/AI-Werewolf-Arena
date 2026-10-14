/**
 * 负责 杠精 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import {
  COMPONENT,
  Role,
  Camp,
  Phase,
  DEBATER_POLICIES,
  type RoleComponent,
} from "../../../../core/domain";
import type { NativeRoleContributions } from "../contracts";
import { numberOrNull } from "../../llm/helpers";
import { getDebaterState, projectDebaterState, initializeDebaterState } from "./state";
import { debateAuthority, hasDebateCommit } from "./authority";
import { sameOriginalParticipant as sameDebateParticipant } from "../../../../core/domain/original-participant";
const parameters = z.strictObject({
  policy: z.enum(DEBATER_POLICIES).default("awa_melbourne_2026_speech_gap_v1"),
});
export const DEBATER_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.Debater,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    label: roleName("debater"),
    skillBrief: text("zh-CN", "role.debater.brief"),
    supportedBoardRoles: [
      Role.Debater,
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Guard,
      Role.Idiot,
      Role.WolfKing,
      Role.WhiteWolfKing,
      Role.Knight,
    ],
  },
  runtime: {
    init: initializeDebaterState,
    configuration: {
      schema: parameters,
      defaults: { policy: "awa_melbourne_2026_speech_gap_v1" },
      apply: (config, value) => ({ ...config, debater: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.debater ?? {}),
    },
    toolSpecs: [
      {
        name: "challenge",
        parameters: {
          type: "object",
          properties: { target_id: { type: "integer" } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'challenge args: {"target_id":number}',
        userPromptHintKey: "action.challenge.hint",
      },
    ],
    validationRules: {
      challenge: ({ world, actorId, day, phase, toolCall, debateId }) => {
        const a = debateAuthority(world, debateId),
          role = world.getComponent(actorId, COMPONENT.Role),
          state = getDebaterState(role);
        if (toolCall.name !== "challenge") return { code: RuleError.ToolMismatch };
        if (
          role?.role !== Role.Debater ||
          role.camp !== Camp.Good ||
          !a ||
          a.stage !== "challenge" ||
          a.actorId !== actorId ||
          a.day !== day ||
          phase !== Phase.Day ||
          !state ||
          state.remaining !== 1 ||
          state.choice !== null ||
          hasDebateCommit(world, actorId)
        )
          return { code: RuleError.DebateUnavailable };
        if (
          toolCall.args.target_id !== a.targetId ||
          actorId === a.targetId ||
          !a.participants.has(actorId) ||
          !a.participants.has(a.targetId) ||
          !sameDebateParticipant(world, a.participants.get(actorId)!) ||
          !sameDebateParticipant(world, a.participants.get(a.targetId)!)
        )
          return { code: RuleError.DebateTarget };
        return null;
      },
    },
    baselineAction: (_role, request) =>
      request.allowedTools.includes("challenge") && request.context.debate_target_id !== undefined
        ? { name: "challenge", args: { target_id: request.context.debate_target_id } }
        : null,
    llmRepair: {
      coerce: {
        challenge: (args) => {
          const target = numberOrNull(args.target_id);
          return target === null ? null : { target_id: target };
        },
      },
    },
  },
  presentation: nativeRolePresentation("debater"),
};
