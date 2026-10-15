/**
 * 负责观察层的具名本人知识端口。输入原角色，输出逐字段脱离的已付资源/选择；
 * 完整协作讨论、隐票及结果只留God历史，不把运行窗口或状态容器交给观察者。
 */
import type { RoleComponent } from "../../domain/components/role";
import { getAwakenedWitchState } from "./state";
import { projectAwakenedWitchKnowledge } from "./presentation";
export function projectAwakenedWitch(role: RoleComponent | undefined) {
  const state = getAwakenedWitchState(role);
  return state ? projectAwakenedWitchKnowledge(state) : null;
}
