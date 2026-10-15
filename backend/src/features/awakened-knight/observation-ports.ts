/**
 * 负责觉醒骑士本人尝试历史的具名值端口。输入原Role，输出脱离且逐字段选择的历史或null。
 * Wolf/Good分支仅是已付尝试所知事实，不复制真实Alive、延期遗言队列、链继续程序或目标许可。
 */
import type { RoleComponent } from "../../domain/components/role";
import type { AwakenedKnightState } from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import { getAwakenedKnightState } from "./state";
export function projectAwakenedKnightKnowledge(
  role: RoleComponent | undefined,
): AwakenedKnightState | null {
  const state = getAwakenedKnightState(role);
  if (!state) return null;
  return {
    policy: state.policy,
    attempts: state.attempts.map((a) => ({
      day: a.day,
      chain: a.chain,
      targetId: a.targetId,
      branch: a.branch,
    })),
  };
}
