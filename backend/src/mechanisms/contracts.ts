import { ToolName } from "../domain/model";
import { Role } from "../domain/model";

export interface MechanismToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolSpec {
  name: ToolName;
  llm: MechanismToolSchema;
  argHint: string;
  gatewaySchema?: unknown;
}

export interface StageDirectiveRule {
  match: (allowedTools: ToolName[]) => boolean;
  text: string;
}

export interface RoleSpec {
  role: Role;
  label: string;
  skillBrief: string;
  allowedTools: ToolName[];
}

export interface StageSpec {
  id: string;
  phase: string;
  description?: string;
}

export interface HookSpec {
  id: string;
  event: "voted_out" | "death";
  description?: string;
}
