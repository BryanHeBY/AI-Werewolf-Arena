import { Role } from "../../domain/model";

export interface RolePromptSpec {
  role: Role;
  label: string;
  skillBrief: string;
}

const DEFAULT_SPECS: RolePromptSpec[] = [
  { role: Role.Wolf, label: "狼人", skillBrief: "夜间可狼队夜聊并参与刀人投票" },
  { role: Role.Villager, label: "平民", skillBrief: "无夜间技能，白天通过发言和投票推进局势" },
  { role: Role.Seer, label: "预言家", skillBrief: "每晚可查验一名玩家阵营" },
  { role: Role.Guard, label: "守卫", skillBrief: "每晚可守护一名玩家，通常不可连续同守" },
  { role: Role.Witch, label: "女巫", skillBrief: "拥有解药与毒药，可在夜间选择使用" },
  { role: Role.Hunter, label: "猎人", skillBrief: "满足条件时可开枪带走一名玩家" },
  { role: Role.Idiot, label: "白痴", skillBrief: "白天被放逐可翻牌免死并失去投票权" },
];

export class RolePromptRegistry {
  private readonly specByRole = new Map<Role, RolePromptSpec>();

  constructor(specs: RolePromptSpec[] = DEFAULT_SPECS) {
    for (const spec of specs) {
      this.specByRole.set(spec.role, spec);
    }
  }

  label(role: Role): string {
    return this.specByRole.get(role)?.label ?? role;
  }

  skillBrief(role: Role): string {
    return this.specByRole.get(role)?.skillBrief ?? "请按当前规则解释该角色技能";
  }
}

let defaultRegistry: RolePromptRegistry | null = null;

export function getDefaultRolePromptRegistry(): RolePromptRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RolePromptRegistry();
  }
  return defaultRegistry;
}
