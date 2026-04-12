/** 文件说明：机制层公共规格类型定义。 */
import { ToolName } from "../domain/model";
import { Role } from "../domain/model";

/** 工具 schema 描述结构。 */
export interface MechanismToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** 工具规格定义。 */
export interface ToolSpec {
  name: ToolName;
  llm: MechanismToolSchema;
  argHint: string;
  userPromptHint?: string;
  gatewaySchema?: unknown;
}

/** 阶段提示词匹配规则。 */
export interface StageDirectiveRule {
  match: (allowedTools: ToolName[]) => boolean;
  text: string;
}

/** 角色规格定义。 */
export interface RoleSpec {
  role: Role;
  label: string;
  skillBrief: string;
  allowedTools: ToolName[];
}

/** 阶段规格定义。 */
export interface StageSpec {
  id: string;
  phase: string;
  description?: string;
}

/** 钩子规格定义。 */
export interface HookSpec {
  id: string;
  event: "voted_out" | "death";
  description?: string;
}
