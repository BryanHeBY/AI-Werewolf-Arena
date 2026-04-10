import { RoleComponent } from "../../domain/components/role";
import { Role } from "../../domain/model";

export interface RoleProfile {
  role: Role;
  label: string;
  skillBrief: string;
  init?: (roleComp: RoleComponent) => void;
  renderPrompt?: (roleComp: RoleComponent) => string;
}
