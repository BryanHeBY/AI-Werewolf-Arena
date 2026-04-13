/** 文件说明：角色 profile 的统一契约定义。 */
import { RoleComponent } from "../../domain/components/role";
import { ActionRequest, BoardConfig, Camp, Role, ToolCall } from "../../domain/model";
import type { ToolSpec, StageDirectiveRule } from "../contracts";
import type { ToolRepairPack } from "../llm/contracts";
import type { NightStageHandler } from "../stages/night/contracts";
import type { ToolRuleMap } from "../validation/contracts";
import type { DeathHook, VotedOutHook } from "../hooks/hook_registry";

/** 角色初始化上下文。 */
export interface RoleInitContext {
  boardConfig?: BoardConfig;
}

/** 单个角色在机制层的完整配置描述。 */
export interface RoleProfile {
  role: Role;
  camp?: Camp;
  label: string;
  skillBrief: string;
  goodSide?: "god" | "villager";
  init?: (roleComp: RoleComponent, ctx: RoleInitContext) => void;
  renderPrompt?: (roleComp: RoleComponent) => string;
  toolSpecs?: ToolSpec[];
  stageDirectives?: StageDirectiveRule[];
  validationRules?: ToolRuleMap;
  nightStages?: NightStageHandler[];
  llmRepair?: ToolRepairPack;
  votedOutHook?: VotedOutHook;
  deathHook?: DeathHook;
  baselineAction?: (
    roleComp: RoleComponent,
    request: ActionRequest,
    pickAliveNotSelf: () => number | null,
    pickAliveByCamp: (camp: "good" | "wolf" | "third_party") => number | null,
  ) => ToolCall | null;
}
