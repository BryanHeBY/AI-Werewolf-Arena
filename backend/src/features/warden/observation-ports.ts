/** 负责主持者本人知识投影；输入为当前Role组件与本人ID，输出脱离DTO，不暴露其他参与者choice或resolved，也不返回库存／窗口句柄。 */
import type { RoleComponent } from "../../domain/components/role";
import { getWardenState } from "./state";
import { projectWardenKnowledge } from "./presentation";
export function wardenOwnKnowledge(role: RoleComponent | undefined, actorId: number) {
  if (role?.role !== "warden") return null;
  const s = getWardenState(role);
  return s ? projectWardenKnowledge(s, actorId) : null;
}
