import { PotionType, Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";
import { getWitchState, setWitchState } from "../private_state";
import { WITCH_LLM_REPAIR_PACK } from "./llm_repair";
import { WITCH_NIGHT_STAGES } from "./night_stages";
import { WITCH_TOOL_SPECS, WITCH_STAGE_DIRECTIVES } from "./tool_specs";
import { WITCH_VALIDATION_RULES } from "./validation_rules";

export const WITCH_ROLE_PROFILE: RoleProfile = {
  role: Role.Witch,
  label: "女巫",
  skillBrief: "拥有解药与毒药，可在夜间选择使用",
  goodSide: "god",
  init: (roleComp) => {
    setWitchState(roleComp, {
      heal: 1,
      poison: 1,
      canSelfHeal: false,
      healUsedThisNight: false,
      poisonUsedThisNight: false,
    });
  },
  renderPrompt: (roleComp) =>
    `你的底牌是【女巫】。解药:${getWitchState(roleComp)?.heal ?? 0} 毒药:${getWitchState(roleComp)?.poison ?? 0}`,
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
};
