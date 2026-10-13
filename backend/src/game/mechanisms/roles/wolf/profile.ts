/**
 * 负责 狼人 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：狼人角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { WOLF_LLM_REPAIR_PACK } from "./llm_repair";
import { WOLF_NIGHT_STAGES } from "./night_stages";
import { WOLF_TOOL_SPECS, WOLF_STAGE_DIRECTIVES } from "./tool_specs";
import { WOLF_VALIDATION_RULES } from "./validation_rules";
import { isMistRavenBoard, mistKnifeTargets } from "../mist_raven/night_frame";

/** 狼人角色配置。 */
export const WOLF_ROLE_PROFILE: RoleProfile = {
  role: Role.Wolf,
  camp: Camp.Wolf,
  canSelfDestruct: true,
  wolfTeam: { recognizedByPack: true, recognizes: "pack", canChat: true, canVoteForKill: true },
  label: roleName("wolf"),
  skillBrief: text("zh-CN", "role.wolf.brief"),
  ...nativeRolePresentation("wolf"),
  toolSpecs: WOLF_TOOL_SPECS,
  stageDirectives: WOLF_STAGE_DIRECTIVES,
  validationRules: WOLF_VALIDATION_RULES,
  nightStages: WOLF_NIGHT_STAGES,
  llmRepair: WOLF_LLM_REPAIR_PACK,
  baselineAction: (
    _roleComp,
    request,
    _pickAliveNotSelf,
    pickAliveByCamp,
    locale = "zh-CN",
    world,
  ) => {
    if (request.allowedTools.includes("speak_to_wolves")) {
      return {
        name: "speak_to_wolves",
        args: {
          text: text(locale, "fallback.wolf_chat"),
          end_chat: false,
        },
      };
    }
    if (request.allowedTools.includes("kill_vote")) {
      const circle = world && isMistRavenBoard(world) ? mistKnifeTargets(world) : null;
      if (circle !== null) {
        const target = circle[0] ?? null;
        return { name: "kill_vote", args: { target_id: target, abstain: target === null } };
      }
      const target = pickAliveByCamp("good");
      if (target !== null) {
        return { name: "kill_vote", args: { target_id: target, abstain: false } };
      }
      return { name: "kill_vote", args: { target_id: null, abstain: true } };
    }
    if (request.allowedTools.includes("self_destruct")) {
      // 自爆属于高风险动作：fallback 不应在“可选中断窗口”默认触发。
      return null;
    }
    return null;
  },
};
