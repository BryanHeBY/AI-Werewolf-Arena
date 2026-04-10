import { RoleComponent } from "../../domain/components/role";
import { ActionRequest, Role, ToolCall } from "../../domain/model";
import type { ToolSpec, StageDirectiveRule } from "../contracts";
import type { ToolRepairPack } from "../llm/contracts";
import type { NightStageHandler } from "../stages/night/contracts";
import type { ToolRuleMap } from "../validation/contracts";
import type { DeathHook, VotedOutHook } from "../hooks/hook_registry";

export interface RoleProfile {
  role: Role;
  label: string;
  skillBrief: string;
  goodSide?: "god" | "villager";
  init?: (roleComp: RoleComponent) => void;
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
