import { Role, ToolName } from "../model";

const BASE_ALLOWED_TOOLS: Record<Role, ToolName[]> = {
  [Role.Wolf]: ["speak_to_wolves", "kill_vote", "self_destruct", "speak", "vote"],
  [Role.Villager]: ["speak", "vote"],
  [Role.Seer]: ["check_identity", "speak", "vote"],
  [Role.Guard]: ["guard", "speak", "vote"],
  [Role.Witch]: ["use_potion", "speak", "vote"],
  [Role.Hunter]: ["shoot", "speak", "vote"],
  [Role.Idiot]: ["speak", "vote"],
};

export class RoleRegistry {
  private readonly toolMap: Map<Role, ToolName[]> = new Map();

  constructor() {
    for (const role of Object.values(Role)) {
      this.toolMap.set(role, [...BASE_ALLOWED_TOOLS[role]]);
    }
  }

  getAllowedTools(role: Role): ToolName[] {
    return [...(this.toolMap.get(role) ?? [])];
  }

  registerAllowedTools(role: Role, tools: ToolName[]): void {
    this.toolMap.set(role, [...tools]);
  }
}
