/**
 * 负责把已接受的胜利判定投影成结构化结果。输入为当前胜利归属、已判目标与原因，输出保留获胜成员和 claim 数据。
 * 本模块不重新选择屠边政策、不修改玩家组件；判胜仍由原胜利条件与检查点负责。
 */
import type { GameOutcome, VictoryClaim, VictoryTarget } from "@ai-werewolf-arena/game-contract";
import { COMPONENT, type WinDecision, type World } from "../../domain";
import type { VictoryComponent } from "../../domain/components/victory";
import { readGameOutcome } from "@ai-werewolf-arena/replay-contract";

/** 成员来自明确 Victory 组件，不根据角色或真实阵营推断。 */
export function victoryDecision(
  world: World,
  primary: VictoryTarget,
  reason: string,
  additional: readonly VictoryTarget[] = [],
): WinDecision {
  const claim = (target: VictoryTarget): VictoryClaim => {
    const winningPlayerIds = world.entityIds().filter((id) => {
      if (target.kind === "individual" && id !== target.playerId) return false;
      return (
        world
          .getComponent(id, COMPONENT.Victory)
          ?.affiliations.some(
            (member) =>
              (target.kind === "faction" &&
                member.kind === "faction" &&
                target.faction === member.faction) ||
              (target.kind === "individual" &&
                member.kind === "individual" &&
                target.goalId === member.goalId) ||
              (target.kind === "relationship" &&
                member.kind === "relationship" &&
                target.groupId === member.groupId),
          ) === true
      );
    });
    if (target.kind !== "faction" && winningPlayerIds.length === 0)
      throw new Error("victory_target_has_no_members");
    return { ...target, winningPlayerIds };
  };
  const first = claim(primary),
    others = additional.map(claim);
  const outcome: GameOutcome = {
    kind: "victory",
    primary: first,
    additional: others,
    winningPlayerIds: [
      ...new Set([first, ...others].flatMap((item) => item.winningPlayerIds)),
    ].sort((a, b) => a - b),
  };
  if (typeof reason !== "string" || reason.length === 0) throw new Error("victory_reason_invalid");
  return {
    winner: primary.kind === "faction" ? (primary.faction as WinDecision["winner"]) : null,
    reason,
    outcome: readGameOutcome(outcome, world.entityIds()),
  };
}
