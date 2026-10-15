/**
 * 负责觉醒狼美人本人知识的具名只读端口。输入原Role，输出白名单DTO或null，不提供状态容器或替死权限。
 * 已付God receipt只派生replacementUsed布尔，preventedCauses/rootPhase/phase不进入玩家观察。
 */
import type { RoleComponent } from "../../domain/components/role";
import { getAwakenedBeautyState } from "./state";
import { awakenedBeautyKnowledge } from "./presentation";
export function projectAwakenedBeautyKnowledge(role: RoleComponent | undefined) {
  const state = getAwakenedBeautyState(role);
  return state ? awakenedBeautyKnowledge(state) : null;
}
