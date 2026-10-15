/**
 * 负责共享普通狼贡献的完整装配，供普通狼人及派生角色复用原资料、狼聊、狼刀、自爆与 mock。
 * 输入是原狼工具、阶段、校验、修复与提示定义；输出是唯一普通狼三贡献对象及原数组、handler 和回调引用。
 * 保留 metadata、runtime、presentation 的创建顺序及普通狼默认展示；实际 Catalog 注册仍由 wolf/profile 入口引用。
 * 派生角色在原字段读取／展开点读取这一可写对象，运行时替换 runtime 或 getter 仍按原时点生效，不提前缓存。
 * 本模块不建立通用角色基类，不推进阶段或付款，不授予生命、库存和租约写权；展示身份不构成行动许可。
 */
import { ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../domain/model";
import { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { WOLF_LLM_REPAIR_PACK } from "./llm-repair";
import { WOLF_NIGHT_STAGES } from "./night-stages";
import { WOLF_TOOL_SPECS, WOLF_STAGE_DIRECTIVES } from "./tool-specs";
import { WOLF_VALIDATION_RULES } from "../../rulesets/wolf-tool-admission";
import { isMistRavenBoard, mistKnifeTargets } from "../mist-raven/ports";

/** 同一对象保留原四字段资料、完整运行贡献和最后创建的普通狼人展示；字段仍可写，不预取 runtime。 */
export const ORDINARY_WOLF_CONTRIBUTIONS: NativeRoleContributions = {
  metadata: {
    role: Role.Wolf,
    camp: Camp.Wolf,
    label: roleName("wolf"),
    skillBrief: text("zh-CN", "role.wolf.brief"),
  },
  runtime: {
    canSelfDestruct: true,
    wolfTeam: { recognizedByPack: true, recognizes: "pack", canChat: true, canVoteForKill: true },
    toolSpecs: WOLF_TOOL_SPECS,
    stageDirectives: WOLF_STAGE_DIRECTIVES,
    validationRules: WOLF_VALIDATION_RULES,
    nightStages: WOLF_NIGHT_STAGES,
    llmRepair: WOLF_LLM_REPAIR_PACK,
    baselineAction: ownRoleCallback("baselineAction", {
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
    }),
  },
  presentation: nativeRolePresentation("wolf"),
};
