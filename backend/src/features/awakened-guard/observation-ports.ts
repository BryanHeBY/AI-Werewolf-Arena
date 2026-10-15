/**
 * 负责觉醒守卫本人周期知识的具名值端口。输入原Role，输出逐字段白名单副本或null。
 * 历史只有本人已付选择与open/pass/unused，不包含God阻挡原因、目标原life或保护许可；输出不能恢复写权。
 */
import type { RoleComponent } from "../../domain/components/role";
import type { AwakenedGuardState } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import { getAwakenedGuardState } from "./state";
export function projectAwakenedGuardKnowledge(
  role: RoleComponent | undefined,
): AwakenedGuardState | null {
  const state = getAwakenedGuardState(role);
  if (!state) return null;
  return {
    policy: state.policy,
    cycles: state.cycles.map((c) =>
      c.status === "protected"
        ? { day: c.day, status: c.status, targetId: c.targetId, timing: c.timing }
        : { day: c.day, status: c.status },
    ),
  };
}
