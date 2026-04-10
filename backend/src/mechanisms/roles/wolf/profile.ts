/** 文件说明：狼人角色 profile。 */
import { Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";
import { WOLF_LLM_REPAIR_PACK } from "./llm_repair";
import { WOLF_NIGHT_STAGES } from "./night_stages";
import { WOLF_TOOL_SPECS, WOLF_STAGE_DIRECTIVES } from "./tool_specs";
import { WOLF_VALIDATION_RULES } from "./validation_rules";

/** 狼人角色配置。 */
export const WOLF_ROLE_PROFILE: RoleProfile = {
  role: Role.Wolf,
  label: "狼人",
  skillBrief: "夜间可狼队夜聊并参与刀人投票",
  renderPrompt: () => "你的底牌是【狼人】。你可以参与夜间战术交流和刀人投票。",
  toolSpecs: WOLF_TOOL_SPECS,
  stageDirectives: WOLF_STAGE_DIRECTIVES,
  validationRules: WOLF_VALIDATION_RULES,
  nightStages: WOLF_NIGHT_STAGES,
  llmRepair: WOLF_LLM_REPAIR_PACK,
  baselineAction: (_roleComp, request, _pickAliveNotSelf, pickAliveByCamp) => {
    if (request.allowedTools.includes("speak_to_wolves")) {
      return {
        name: "speak_to_wolves",
        args: {
          text: "今晚优先刀信息位。",
          end_chat: false,
        },
      };
    }
    if (request.allowedTools.includes("kill_vote")) {
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
