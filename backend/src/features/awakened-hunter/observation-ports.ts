/**
 * 负责觉醒猎人本人已付巡猎的只读知识端口。输入原Role，输出逐字段脱离付款，或无本族状态时null。
 * 不查询真实狼位、不暴露付款容器或死亡许可；付款记录不证明目标已经真实死亡。
 */
import type { RoleComponent } from "../../domain/components/role";
import { getAwakenedPatrolState } from "./state";
export function projectAwakenedPatrolKnowledge(role: RoleComponent | undefined) {
  const s = getAwakenedPatrolState(role),
    p = s?.payment;
  if (!s) return null;
  return {
    policy: s.policy,
    payment: p
      ? { day: p.day, rootPhase: p.rootPhase, direction: p.direction, targetId: p.targetId }
      : null,
  };
}
